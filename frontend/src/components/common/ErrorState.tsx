export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[10px] border border-[var(--red-tint)] bg-[var(--red-tint)] px-4 py-3 text-sm text-[var(--red-active)]"
    >
      {message}
    </div>
  );
}
