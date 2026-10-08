interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ username, avatarUrl, size = 'md' }: AvatarProps) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const colors = [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];

  const colorIndex = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizes[size]} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-medium`}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}