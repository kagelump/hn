// Time utility functions

export function timeAgo(time: number, local?: number): string {
  const now = local ?? Date.now();

  if (typeof time !== 'number' || typeof now !== 'number') {
    return '';
  }

  const offset = Math.abs((now - time) / 1000);
  const MINUTE = 60;
  const HOUR = 3600;
  const date = new Date(time);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (offset <= MINUTE) {
    return 'Just now!';
  } else if (offset < MINUTE * 60) {
    const minutes = Math.round(offset / MINUTE);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (offset < HOUR * 24) {
    const hours = Math.round(offset / HOUR);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else {
    return `${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`;
  }
}
