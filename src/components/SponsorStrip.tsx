import Image from "next/image";

const sponsors = [
  { src: "/sponsors/bbd.png", alt: "BBD Software Development", w: 90 },
  { src: "/sponsors/boxfusion.png", alt: "Boxfusion", w: 110 },
  { src: "/sponsors/offerzen.jpg", alt: "OfferZen", w: 100 },
  { src: "/sponsors/enactus.png", alt: "Enactus Wits", w: 130 },
  { src: "/sponsors/anylytical.png", alt: "Anylytical Technologies", w: 140, h: 33 },
];

export function SponsorStrip() {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[10px] tracking-widest text-ink/40">
        SPONSORS &amp; PARTNERS
      </span>
      <div className="flex flex-wrap items-center gap-6">
        {sponsors.map((s) => (
          // A couple of these logos are opaque JPEGs/PNGs with a baked-in
          // white background — this chip keeps them legible against both
          // the light page and the dark-mode page, instead of a stray
          // white rectangle on a dark background.
          <div key={s.src} className="bg-surface px-3 py-2" style={{ display: "inline-block" }}>
            <Image src={s.src} alt={s.alt} width={s.w} height={s.h ?? s.w / 2.6} style={{ objectFit: "contain", height: "auto" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
