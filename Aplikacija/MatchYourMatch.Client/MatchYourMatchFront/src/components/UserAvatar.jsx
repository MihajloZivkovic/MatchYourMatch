import { useState } from 'react';
import { getProfileImageUrl } from '../utils/profileImage';

function UserAvatar({ profilePicture, initials = 'MY', alt = '', className = '', style }) {
  const imageUrl = getProfileImageUrl(profilePicture);
  const [failedUrl, setFailedUrl] = useState(null);

  return (
    <span className={className} style={style}>
      {imageUrl && imageUrl !== failedUrl
        ? <img src={imageUrl} alt={alt} onError={() => setFailedUrl(imageUrl)} />
        : initials}
    </span>
  );
}

export default UserAvatar;
