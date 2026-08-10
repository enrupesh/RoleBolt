"use client";

type Props = {
  mode: "email" | "username";
  onChange: (mode: "email" | "username") => void;
  accent?: "recruit" | "seeker";
};

export function LoginMethodSwitch({ mode, onChange, accent = "recruit" }: Props) {
  const active = accent === "seeker"
    ? "bg-indigo-600 text-white shadow-sm"
    : "bg-[#0a66c2] text-white shadow-sm";

  return (
    <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      {(["email", "username"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold capitalize transition ${
            mode === m ? active : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {m === "email" ? "Email" : "Username"}
        </button>
      ))}
    </div>
  );
}
