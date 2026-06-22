import { useEffect, useState } from "react";
import { Download, FileText, Maximize2 } from "lucide-react";
import "./ChatMedia.css";

export default function AttachmentView({ attachment }) {
  const [blobUrl, setBlobUrl] = useState("");
  const [error, setError] = useState("");
  const isGif = attachment?.kind?.toLowerCase() === "gif";

  useEffect(() => {
    if (!attachment?.isImage || !attachment.downloadUrl || isGif) return undefined;
    const controller = new AbortController();
    fetch(attachment.downloadUrl, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, signal: controller.signal })
      .then((response) => response.ok ? response.blob() : Promise.reject(new Error()))
      .then((blob) => setBlobUrl(URL.createObjectURL(blob)))
      .catch((err) => { if (err.name !== "AbortError") setError("Image unavailable"); });
    return () => { controller.abort(); setBlobUrl((url) => { if (url) URL.revokeObjectURL(url); return ""; }); };
  }, [attachment?.downloadUrl, attachment?.isImage, isGif]);

  if (!attachment) return null;
  if (isGif) return <a className="chat-media__gif" href={attachment.originalUrl} target="_blank" rel="noreferrer"><img src={attachment.previewUrl || attachment.originalUrl} alt="GIF" /><small>Powered by GIPHY</small></a>;
  if (attachment.isImage) return blobUrl ? <a className="chat-media__image" href={blobUrl} target="_blank" rel="noreferrer"><img src={blobUrl} alt={attachment.originalFileName || "Attachment"} /><Maximize2 size={15} /></a> : <span className="chat-media__error">{error || "Loading image…"}</span>;

  const download = async () => {
    setError("");
    try {
      const response = await fetch(attachment.downloadUrl, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = attachment.originalFileName || "attachment"; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Download failed"); }
  };
  return <div className="chat-media__document"><FileText size={24} /><span><strong>{attachment.originalFileName}</strong><small>{formatBytes(attachment.size)}</small></span><button type="button" onClick={download} aria-label="Download attachment"><Download size={17} /></button>{error && <em>{error}</em>}</div>;
}

const formatBytes = (size = 0) => size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`;
