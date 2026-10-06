<template>
  <main class="relative isolate min-h-[calc(100vh-73px)] overflow-hidden px-6 py-10 sm:px-8">
    <div class="pointer-events-none absolute -left-32 top-8 -z-10 h-96 w-96 rounded-full bg-lilac/10 blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-40 right-0 -z-10 h-96 w-96 rounded-full bg-apricot/10 blur-3xl"></div>

    <div class="mx-auto max-w-6xl">
      <header class="mb-6">
        <p class="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-mint">Your collector profile</p>
        <h1 class="text-3xl font-bold tracking-tight text-linen sm:text-4xl">My profile</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-linen/55">
          Your collector profile and reputation among other collectors, sellers, and traders.
        </p>
      </header>

      <section class="mb-6 rounded-2xl border border-white/10 bg-panel/90 p-6 shadow-xl shadow-black/10 sm:p-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-apricot text-2xl font-black text-ink shadow-lg shadow-apricot/15">
            KM
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 class="text-2xl font-bold text-linen">KortMads</h2>
              <span class="rounded-full bg-mint/15 px-3 py-1 text-xs font-semibold text-mint">Active collector</span>
            </div>
            <p class="mt-2 text-sm text-linen/55">Aarhus · Member since January 2026</p>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-linen/70">
              Mainly collecting Charizard and original Pokémon sets. Open to serious trade offers.
            </p>
            <div class="mt-4 flex flex-wrap gap-3">
              <button class="rounded-xl bg-apricot px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-apricot/90 focus:outline-none focus:ring-2 focus:ring-apricot/50">
                Edit profile
              </button>
              <button class="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-linen transition hover:border-lilac hover:text-lilac focus:outline-none focus:ring-2 focus:ring-lilac/50">
                View public profile
              </button>
            </div>
          </div>
        </div>

        <div class="mt-7 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
          <div>
            <p class="text-2xl font-bold text-apricot">—</p>
            <p class="mt-1 text-xs text-linen/50">Rating</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-linen">0</p>
            <p class="mt-1 text-xs text-linen/50">Transactions</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-linen">0</p>
            <p class="mt-1 text-xs text-linen/50">Completed trades</p>
          </div>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-[1.6fr_0.8fr]">
        <section class="overflow-hidden rounded-2xl border border-white/10 bg-panel/85">
          <div class="border-b border-white/10 px-6 py-5 sm:px-7">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-xl font-bold text-linen">Reviews</h2>
                <p class="mt-1 text-sm text-linen/50">Feedback from completed transactions.</p>
              </div>
              <span class="rounded-full bg-lilac/15 px-3 py-1 text-xs font-bold text-lilac">0 reviews</span>
            </div>
            <div class="mt-5 flex flex-wrap gap-2">
              <button class="rounded-lg bg-apricot px-3 py-2 text-xs font-bold text-ink">All · 0</button>
              <button class="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-linen/50" disabled>Buy and sell</button>
              <button class="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-linen/50" disabled>Trades</button>
            </div>
          </div>
          <div class="px-6 py-16 text-center sm:px-7">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-lilac/10 text-xl text-lilac">✦</div>
            <h3 class="mt-4 text-lg font-semibold text-linen">No reviews</h3>
            <p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-linen/50">
              Reviews will appear here once you have completed your first transaction or trade.
            </p>
          </div>
        </section>

        <aside class="space-y-6">
          <section class="rounded-2xl border border-white/10 bg-panel/85 p-6">
            <h2 class="text-lg font-bold text-linen">My cards</h2>
            <p class="mt-4 text-sm font-semibold text-apricot">My collection →</p>
            <div class="mt-3 flex items-center justify-between text-sm text-linen/55">
              <span>Listings (0)</span>
              <span>Trade cards (0)</span>
            </div>
          </section>

          <section class="rounded-2xl border border-white/10 bg-panel/85 p-6">
            <h2 class="text-lg font-bold text-linen">Groups and interests</h2>
            <div class="mt-4 space-y-3 text-sm">
              <p class="font-semibold text-lilac">Pokémon Denmark</p>
              <p class="font-semibold text-lilac">Charizard collectors</p>
              <p class="text-apricot">Find groups →</p>
            </div>
          </section>

          <section class="rounded-2xl border border-white/10 bg-panel/85 p-6">
            <h2 class="text-lg font-bold text-linen">Visible only to you</h2>
            <div class="mt-4 space-y-3 text-sm">
              <div class="flex items-center justify-between gap-4">
                <span class="text-linen/55">Account and security</span>
                <span class="text-linen/30">→</span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span class="text-linen/55">Notifications</span>
                <span class="text-linen/30">→</span>
              </div>
              <p class="font-semibold text-apricot">Profile visibility and privacy →</p>
              <p class="text-xs leading-5 text-linen/40">Your address and contact details are not shown publicly.</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </main>
</template>
