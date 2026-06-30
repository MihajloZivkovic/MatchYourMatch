import { useEffect, useState } from 'react';
import { getProfileImageUrl } from '../utils/profileImage';

function UserAvatar({
  profilePicture,
  initials = 'MY',
  alt = '',
  className = '',
  style,
}) {
  const imageUrl = getProfileImageUrl(profilePicture);
  const [failedUrl, setFailedUrl] = useState(null);

  useEffect(() => {
    setFailedUrl(null);
  }, [imageUrl]);

  return (
    <span className={className} style={style}>
      {imageUrl && imageUrl !== failedUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          onError={() => {
            console.warn('[UserAvatar] Failed to load profile image:', imageUrl);
            setFailedUrl(imageUrl);
          }}
        />
      ) : (
        initials
      )}
    </span>
  );
}

export default UserAvatar;
