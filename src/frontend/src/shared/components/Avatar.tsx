type AvatarProps = {
  name?: string | null;
  src?: string | null;
  status?: string | null;
  size?: 'sm' | 'md' | 'lg';
};

export function Avatar({ name, src, status, size = 'md' }: AvatarProps) {
  const initial = name?.trim()?.[0]?.toUpperCase() || '?';

  return (
    <div className={`avatar avatar-${size}`}>
      {src ? <img src={src} alt="" /> : <span>{initial}</span>}
      {status && <span className={`presence presence-${status}`} />}
    </div>
  );
}
