import { cn } from "@/lib/utils";

export function GridBackgroundDemo() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 flex w-full items-center justify-center bg-black overflow-hidden">
      <div
        className={cn(
          "absolute inset-0",
          "bg-size-[40px_40px]",
          "bg-[linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]",
        )}
      />
      {/* Radial gradient for the container to give a faded look */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black mask-[radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <p className="relative z-20 bg-linear-to-b from-neutral-200 to-neutral-500 bg-clip-text py-8 text-4xl font-bold text-transparent sm:text-7xl">
        
      </p>
    </div>
  );
}