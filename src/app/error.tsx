'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-md border border-red-200 bg-red-50 p-6 text-center">
      <h2 className="mb-2 text-lg font-semibold text-red-700">Ocurrió un error</h2>
      <p className="mb-4 text-sm text-red-600">{error.message}</p>
      {error.digest && (
        <p className="mb-4 text-xs text-red-400">Código de referencia: {error.digest}</p>
      )}
      <button
        onClick={() => reset()}
        className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
      >
        Reintentar
      </button>
    </div>
  );
}
