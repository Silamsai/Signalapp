"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "./Field";

/** Password field with a show/hide eye toggle. Hidden by default. */
export function PasswordInput({
  wrapperClassName = "mt-1.5",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { wrapperClassName?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input {...props} type={visible ? "text" : "password"} className={`${inputClass} !mt-0 pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[7px] text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--red)]"
      >
        {visible ? <EyeOff size={16} strokeWidth={1.75} aria-hidden /> : <Eye size={16} strokeWidth={1.75} aria-hidden />}
      </button>
    </div>
  );
}
