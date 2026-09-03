"use client";

import { useEffect, useState } from "react";

function formatLocalDate() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function PrivacyDateLine({
  className,
  initialDate,
}: {
  className: string;
  initialDate: string;
}) {
  const [label, setLabel] = useState(`Last Updated: ${initialDate}`);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const next = `Last Updated: ${formatLocalDate()}`;
      setLabel((current) => (current === next ? current : next));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <p className={className}>{label}</p>;
}
