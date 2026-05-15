"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 可以上报错误
    // console.error(error);
  }, [error]);
  return (
    <html>
      <body className="p-8">
        <h2 className="text-red-500 font-medium">出错了</h2>
        <p className="text-sm opacity-80">{error.message}</p>
        <button onClick={() => reset()} className="mt-4 px-3 py-1 rounded-md border">重试</button>
      </body>
    </html>
  );
}


