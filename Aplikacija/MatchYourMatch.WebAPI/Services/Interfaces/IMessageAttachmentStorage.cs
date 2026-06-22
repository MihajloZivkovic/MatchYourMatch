using MatchYourMatch.WebAPI.Models;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IMessageAttachmentStorage
    {
        Task<MessageAttachment> SaveAsync(IFormFile file, CancellationToken cancellationToken = default);
        Task<Stream> OpenReadAsync(MessageAttachment attachment, CancellationToken cancellationToken = default);
        Task DeleteAsync(MessageAttachment? attachment);
    }
}
