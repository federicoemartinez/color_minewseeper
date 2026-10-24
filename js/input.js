export const TAP_DELAY_MS = 250;

// Single tap waits TAP_DELAY_MS to see if a second tap on the same square follows.
// Timers are looked up at call time so test mocks of setTimeout/clearTimeout apply.
export const createTapHandler = ({ onTap, onDoubleTap, delayMs = TAP_DELAY_MS }) => {
  let pending = null; // { square, timer }

  const flush = () => {
    const { square } = pending;
    pending = null;
    onTap(square);
  };

  return (square) => {
    if (pending && pending.square === square) {
      clearTimeout(pending.timer);
      pending = null;
      onDoubleTap(square);
      return;
    }
    if (pending) {
      clearTimeout(pending.timer);
      flush();
    }
    const timer = setTimeout(flush, delayMs);
    pending = { square, timer };
  };
};
