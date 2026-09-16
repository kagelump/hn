/** Share the complete content as an attachment, without a separate text payload. */
export async function shareTextFile(title: string, text: string, kind: 'article' | 'discussion'): Promise<void> {
  const name = title.replace(/[<>:"/\\|?*\p{Cc}]/gu, '-').trim().replace(/[. ]+$/g, '').slice(0, 100) || 'Hacker News';
  const file = new File([text], `${name}-${kind}.txt`, { type: 'text/plain' });
  const payload: ShareData = { files: [file] };

  try {
    // Keep this synchronous until share() to preserve the tap's user activation.
    if (navigator.share && navigator.canShare?.(payload)) {
      await navigator.share(payload);
      return;
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return;
    alert('Could not share the attachment. Please try again.');
    return;
  }

  // Browsers without file sharing can save the attachment for manual upload.
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow the browser to start reading the download before releasing its URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
