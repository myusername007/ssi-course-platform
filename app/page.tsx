const links = [
  {
    href: "/courses",
    title: "Курси",
    description: "Список курсів, підключення MetaMask і запис на курс.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 py-24 px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            SSI Course Platform
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Тимчасова головна сторінка з посиланнями на всі наявні розділи
            сайту.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex flex-col gap-1 rounded-lg border border-black/[.08] p-5 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              <span className="text-lg font-medium text-black dark:text-zinc-50">
                {link.title}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {link.description}
              </span>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
