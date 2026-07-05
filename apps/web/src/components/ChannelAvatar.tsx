interface ChannelAvatarProps {
  avatar: string;
  name: string;
  className?: string;
  emojiClassName?: string;
}

export default function ChannelAvatar({
  avatar,
  name,
  className = 'w-8 h-8 rounded-full object-cover',
  emojiClassName = 'text-lg',
}: ChannelAvatarProps) {
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return <img src={avatar} alt={name} className={className} />;
  }
  return <span className={emojiClassName}>{avatar || '📺'}</span>;
}
