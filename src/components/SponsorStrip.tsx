import Image from "next/image";

const sponsors = [
  { src: "/sponsors/bbd.png", alt: "BBD Software Development", w: 90 },
  { src: "/sponsors/boxfusion.png", alt: "Boxfusion", w: 110 },
  { src: "/sponsors/offerzen.jpg", alt: "OfferZen", w: 100 },
];

export function SponsorStrip({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <span
        className={`font-mono text-[10px] tracking-widest ${
          dark ? "text-paper/40" : "text-ink/40"
        }`}
      >
        SPONSORS &amp; PARTNERS
      </span>
      <div className="flex flex-wrap items-center gap-6">
        {sponsors.map((s) => (
          <div
            key={s.src}
            className={dark ? "bg-paper px-3 py-2" : "px-1"}
            style={{ display: "inline-block" }}
          >
            <Image src={s.src} alt={s.alt} width={s.w} height={s.w / 2.6} style={{ objectFit: "contain", height: "auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
