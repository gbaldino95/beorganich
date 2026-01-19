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
      <div className="mt-1 text-[11px] uppercase text-white/55 tracking-[0.18em] sm:tracking-[0.24em]">
  PRIVATE PERSONAL COLOR · ON-DEVICE
      </div>
    </div>
  );
}