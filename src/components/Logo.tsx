export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 6.5C10.5 5.3 8.3 4.5 6 4.5C4.9 4.5 3.9 4.7 3 5V17.5C3.9 17.2 4.9 17 6 17C8.3 17 10.5 17.8 12 19"
        stroke="#0F2044"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 6.5C13.5 5.3 15.7 4.5 18 4.5C19.1 4.5 20.1 4.7 21 5V17.5C20.1 17.2 19.1 17 18 17C15.7 17 13.5 17.8 12 19"
        stroke="#2F6FED"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 6.5V19" stroke="#0F2044" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 24, textClassName = "text-lg" }: { size?: number; textClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`font-semibold text-navy-900 ${textClassName}`}>Smithton Church Newsletter</span>
    </div>
  );
}
