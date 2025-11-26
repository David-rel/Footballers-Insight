type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
};

export default function SectionHeader({ eyebrow, title, subtitle, align = "left" }: SectionHeaderProps) {
  return (
    <div className={`space-y-3 ${align === "center" ? "text-center" : "text-left"}`}>
      {eyebrow && (
        <div className="inline-flex items-center gap-2 rounded-full border border-[#e3ca76]/30 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#e3ca76]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#e3ca76]"></span>
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl font-semibold text-white sm:text-3xl md:text-4xl">{title}</h2>
      {subtitle && <p className="max-w-3xl text-sm text-white/70 sm:text-base">{subtitle}</p>}
    </div>
  );
}
