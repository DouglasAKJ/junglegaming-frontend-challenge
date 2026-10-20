import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="status"
      aria-label="Carregando conteúdo"
      className={cn('skeleton-shimmer rounded-lg', className)}
      {...props}
    />
  );
}

export function NftCardSkeleton() {
  return (
    <div
      data-testid="nft-card-skeleton"
      className="flex flex-col rounded-xl bg-[#241612] p-3 border border-[#3f2319]"
    >
      <Skeleton className="aspect-square w-full rounded-xl mb-3" />
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  );
}

export function CatalogGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      data-testid="catalog-skeleton"
      aria-busy="true"
      aria-live="polite"
      className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 min-h-[760px]"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <NftCardSkeleton key={idx} />
      ))}
    </div>
  );
}

const PREVIEW_IMAGE_BY_ID: Record<string, string> = {
  'emerald-ape-042': '/assets/nfts/ape-emerald.png',
  'cyber-samurai-108': '/assets/nfts/ape-purple.png',
  'golden-monolith-007': '/assets/nfts/ape-golden.png',
  'neon-vessel-552': '/assets/nfts/ape-ivory.png',
};

export function NftDetailSkeleton({ nftId }: { nftId?: string }) {
  const previewSrc = nftId ? PREVIEW_IMAGE_BY_ID[nftId] : undefined;
  return (
    <div
      data-testid="nft-detail-skeleton"
      aria-busy="true"
      aria-live="polite"
      className="max-w-7xl mx-auto px-4 md:px-8 py-8 min-h-[1100px]"
    >
      <Skeleton className="h-5 w-44 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-6 flex flex-col-reverse sm:flex-row gap-4">
          <div className="flex sm:flex-col gap-3 sm:w-20 shrink-0">
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl" />
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl" />
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl" />
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl" />
          </div>
          {previewSrc ? (
            <div className="relative flex-1 aspect-square rounded-2xl bg-[#241612] border border-[#3f2319] p-3 sm:p-4 overflow-hidden">
              <img
                src={previewSrc}
                alt="Carregando obra digital"
                fetchPriority="high"
                width={600}
                height={600}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
          ) : (
            <Skeleton className="flex-1 aspect-square rounded-2xl" />
          )}
        </div>
        <div className="lg:col-span-6 flex flex-col gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-3/4" />
          <div className="flex gap-4 mt-2">
            <Skeleton className="h-11 w-32 rounded-lg" />
            <Skeleton className="h-11 w-40 rounded-lg" />
            <Skeleton className="h-11 w-36 rounded-lg" />
          </div>
          <Skeleton className="h-24 w-full mt-4" />
        </div>
      </div>
    </div>
  );
}

export function CartSummarySkeleton() {
  return (
    <div
      data-testid="cart-summary-skeleton"
      aria-busy="true"
      aria-live="polite"
      className="flex flex-col gap-4 p-6 rounded-xl bg-[#241612] border border-[#3f2319]"
    >
      <Skeleton className="h-6 w-1/2 mb-2" />
      <Skeleton className="h-11 w-full" />
      <div className="space-y-3 py-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="flex justify-between pt-3 border-t border-[#3f2319]">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-28" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg mt-2" />
    </div>
  );
}
