/** Audio-/Video-Wiedergabe direkt im Vorschau-Popup (native Browser-Player). */
export function MediaViewer({
  url,
  name,
  kind,
}: {
  url: string;
  name: string;
  kind: "audio" | "video";
}) {
  if (kind === "video") {
    return (
      <div className="flex size-full items-center justify-center bg-background p-4">
        <video controls src={url} className="max-h-full max-w-full rounded-2xl" title={name} />
      </div>
    );
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-4 bg-background p-8">
      <p className="max-w-full truncate text-sm font-semibold">{name}</p>
      <audio controls src={url} className="w-full max-w-md" />
    </div>
  );
}
