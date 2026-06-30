using System.IO.Compression;
using System.Text;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;

namespace MatchYourMatch.WebAPI.Services
{
    public class MessageAttachmentStorage : IMessageAttachmentStorage
    {
        public const long MaxFileSize = 10 * 1024 * 1024;
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".doc", ".docx",
            ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"
        };

        private readonly string _storageRoot;

        public MessageAttachmentStorage(IWebHostEnvironment environment)
        {
            _storageRoot = Path.GetFullPath(Path.Combine(environment.ContentRootPath, "App_Data", "ChatAttachments"));
            Directory.CreateDirectory(_storageRoot);
        }

        public async Task<MessageAttachment> SaveAsync(IFormFile file, CancellationToken cancellationToken = default)
        {
            if (file == null || file.Length == 0)
                throw new InvalidOperationException("Choose a non-empty file.");
            if (file.Length > MaxFileSize)
                throw new InvalidOperationException("The maximum attachment size is 10 MB.");

            var originalName = Path.GetFileName(file.FileName).Trim();
            if (string.IsNullOrWhiteSpace(originalName) || originalName.Length > 255)
                throw new InvalidOperationException("The file name is invalid.");

            var extension = Path.GetExtension(originalName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(extension))
                throw new InvalidOperationException("This file type is not allowed.");

            await using var source = file.OpenReadStream();
            var contentType = await DetectAndValidateTypeAsync(source, extension, cancellationToken);
            source.Position = 0;

            var storedName = $"{Guid.NewGuid():N}{extension}";
            using var buffer = new MemoryStream((int)file.Length);
            await source.CopyToAsync(buffer, cancellationToken);

            return new MessageAttachment
            {
                Kind = "File",
                OriginalFileName = originalName,
                StoredFileName = storedName,
                ContentType = contentType,
                Size = file.Length,
                StoragePath = "database",
                Content = buffer.ToArray()
            };
        }

        public Task<Stream> OpenReadAsync(MessageAttachment attachment, CancellationToken cancellationToken = default)
        {
            if (attachment.Kind != "File")
                throw new KeyNotFoundException("Attachment file does not exist.");
            if (attachment.Content is { Length: > 0 })
                return Task.FromResult<Stream>(new MemoryStream(attachment.Content, writable: false));
            if (string.IsNullOrWhiteSpace(attachment.StoragePath))
                throw new KeyNotFoundException("Attachment file does not exist.");
            var path = ResolveSafePath(attachment.StoragePath);
            if (!File.Exists(path)) throw new KeyNotFoundException("Attachment file does not exist.");
            Stream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
            return Task.FromResult(stream);
        }

        public Task DeleteAsync(MessageAttachment? attachment)
        {
            if (attachment?.Kind == "File" && !string.IsNullOrWhiteSpace(attachment.StoragePath))
            {
                var path = ResolveSafePath(attachment.StoragePath);
                if (File.Exists(path)) File.Delete(path);
            }
            return Task.CompletedTask;
        }

        private string ResolveSafePath(string relativePath)
        {
            var fullPath = Path.GetFullPath(Path.Combine(_storageRoot, relativePath));
            if (!fullPath.StartsWith(_storageRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Invalid attachment path.");
            return fullPath;
        }

        private static async Task<string> DetectAndValidateTypeAsync(Stream stream, string extension, CancellationToken cancellationToken)
        {
            var header = new byte[Math.Min(512, (int)stream.Length)];
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length), cancellationToken);
            stream.Position = 0;

            bool Starts(params byte[] bytes) => read >= bytes.Length && header.AsSpan(0, bytes.Length).SequenceEqual(bytes);
            var isOle = Starts(0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1);
            var isZip = Starts(0x50, 0x4B, 0x03, 0x04);

            return extension switch
            {
                ".jpg" or ".jpeg" when Starts(0xFF, 0xD8, 0xFF) => "image/jpeg",
                ".png" when Starts(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) => "image/png",
                ".gif" when read >= 6 && (Encoding.ASCII.GetString(header, 0, 6) is "GIF87a" or "GIF89a") => "image/gif",
                ".webp" when read >= 12 && Encoding.ASCII.GetString(header, 0, 4) == "RIFF" && Encoding.ASCII.GetString(header, 8, 4) == "WEBP" => "image/webp",
                ".pdf" when read >= 5 && Encoding.ASCII.GetString(header, 0, 5) == "%PDF-" => "application/pdf",
                ".doc" when isOle => "application/msword",
                ".xls" when isOle => "application/vnd.ms-excel",
                ".ppt" when isOle => "application/vnd.ms-powerpoint",
                ".docx" when isZip && HasOfficeEntry(stream, "word/") => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xlsx" when isZip && HasOfficeEntry(stream, "xl/") => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".pptx" when isZip && HasOfficeEntry(stream, "ppt/") => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ".txt" when IsSafeText(header.AsSpan(0, read)) => "text/plain",
                ".csv" when IsSafeText(header.AsSpan(0, read)) => "text/csv",
                _ => throw new InvalidOperationException("The file content does not match its extension.")
            };
        }

        private static bool HasOfficeEntry(Stream stream, string prefix)
        {
            try
            {
                stream.Position = 0;
                using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
                return archive.Entries.Any(entry => entry.FullName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
            }
            catch (InvalidDataException) { return false; }
            finally { stream.Position = 0; }
        }

        private static bool IsSafeText(ReadOnlySpan<byte> bytes)
        {
            if (bytes.IndexOf((byte)0) >= 0) return false;
            try
            {
                _ = new UTF8Encoding(false, true).GetString(bytes);
                return true;
            }
            catch (DecoderFallbackException) { return false; }
        }
    }
}
