import Image from "next/image";

export default function HomeLogo() {
  return (
    <div className="pt-6 flex flex-col items-center text-center">
      {/* Logo */}
      <div className="relative h-10 w-10">
        <Image
          src="/logo/app-logo.png"
          alt="Beorganich AI"
          fill
          priority
          className="object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.12)]"
        />
      </div>

      {/* Micro label premium */}
      <div className="mt-3 text-[11px] tracking-[0.32em] text-white/55 uppercase">
        Private Personal Color · On-Device
      </div>
    </div>
  );
}