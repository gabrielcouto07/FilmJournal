import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Home "Paladar" — dashboard de análise de gosto e recomendações (`GET /api/recommendations`).
struct HomeView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = HomeViewModel()
    @State private var isShowingPlay = false
    @State private var isShowingExplore = false

    var body: some View {
        FJScreen("Paladar") {
            content
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isShowingPlay = true
                } label: {
                    Image(systemName: AppTab.play.systemImage)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isShowingExplore = true
                } label: {
                    Image(systemName: AppTab.explore.systemImage)
                }
            }
        }
        .sheet(isPresented: $isShowingPlay) {
            PlayFlowView()
        }
        .sheet(isPresented: $isShowingExplore) {
            ExploreFlowView()
        }
        .task {
            await viewModel.load(api: api)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.taste == nil {
            LoadingStateView(message: "Analisando seu gosto…")
        } else if let errorMessage = viewModel.errorMessage, viewModel.taste == nil {
            ErrorStateView(message: errorMessage) {
                Task { await viewModel.load(api: api) }
            }
        } else if let taste = viewModel.taste {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    if taste.profile.ratedFilms < 5 {
                        onboardingCTA
                    }
                    profileHeader(taste.profile)

                    if !taste.becauseYouLoved.isEmpty {
                        recommendationSection(title: "Porque você amou...", items: taste.becauseYouLoved)
                    }
                    if !taste.directors.isEmpty {
                        directorsSection(taste.directors)
                    }
                    if !taste.genreDiscovery.isEmpty {
                        recommendationSection(title: taste.genreDiscoveryLabel, items: taste.genreDiscovery)
                    }
                    if !taste.blindSpots.isEmpty {
                        blindSpotsSection(taste.blindSpots)
                    }
                    if let charts = viewModel.charts, charts.totalFilms > 2 {
                        HomeChartsSection(charts: charts)
                    }
                }
                .padding(.vertical, Spacing.md)
            }
            .refreshable {
                await viewModel.load(refresh: true, api: api)
            }
            .alert("Algo deu errado", isPresented: .constant(viewModel.errorMessage != nil), actions: {
                Button("OK") { viewModel.errorMessage = nil }
            }, message: {
                Text(viewModel.errorMessage ?? "")
            })
        } else {
            EmptyStateView(systemImage: "chart.pie", title: "Paladar", message: "Sem dados por enquanto.")
        }
    }

    private var onboardingCTA: some View {
        Button {
            root.homeRouter.push(.onboardingWelcome)
        } label: {
            HStack {
                Image(systemName: "sparkles")
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Complete seu Paladar").font(.headline)
                    Text("Avalie alguns filmes favoritos para recomendações melhores.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
            }
            .padding(Spacing.md)
            .background(Color.accentColor.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.md)
    }

    private func profileHeader(_ profile: TasteProfile) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(profileSummary(profile))
                .font(.subheadline)
            if !profile.topGenres.isEmpty {
                Text("Gêneros favoritos: \(profile.topGenres.prefix(3).map(\.name).joined(separator: ", "))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, Spacing.md)
    }

    private func profileSummary(_ profile: TasteProfile) -> String {
        var text = "Você já assistiu \(profile.watchedFilms) filmes e avaliou \(profile.ratedFilms)."
        if let decade = profile.favoriteDecade {
            text += " Sua década favorita é \(decade)."
        }
        return text
    }

    private func recommendationSection(title: String, items: [TasteRecommendation]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title).font(.title3.bold()).padding(.horizontal, Spacing.md)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Spacing.md) {
                    ForEach(items) { item in
                        Button {
                            root.homeRouter.push(.filmDetail(.tmdb(item.tmdbId)))
                        } label: {
                            RecommendationCard(item: item)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, Spacing.md)
            }
        }
    }

    private func directorsSection(_ directors: [TasteDirector]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Diretores recorrentes").font(.title3.bold()).padding(.horizontal, Spacing.md)
            VStack(alignment: .leading, spacing: Spacing.lg) {
                ForEach(directors) { director in
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text(director.name).font(.headline)
                        Text(director.reason)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if !director.films.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(alignment: .top, spacing: Spacing.md) {
                                    ForEach(director.films) { item in
                                        Button {
                                            root.homeRouter.push(.filmDetail(.tmdb(item.tmdbId)))
                                        } label: {
                                            RecommendationCard(item: item)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.md)
        }
    }

    private func blindSpotsSection(_ blindSpots: [TasteBlindSpot]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Pontos cegos de resenha").font(.title3.bold()).padding(.horizontal, Spacing.md)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: Spacing.md) {
                    // `TasteBlindSpot.id` é o `movieId` local (não o `tmdbId`), e `FilmDetailTarget`
                    // só aceita `Movie` completo ou `tmdbId` — nenhum dos dois está disponível aqui.
                    // Não há endpoint para resolver movieId -> tmdbId, então esses itens ficam sem
                    // ação de toque por ora (limitação aceita, não um bug).
                    ForEach(blindSpots) { item in
                        BlindSpotCard(item: item)
                    }
                }
                .padding(.horizontal, Spacing.md)
            }
        }
    }
}

private struct RecommendationCard: View {
    let item: TasteRecommendation

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            RemotePosterImage(path: item.effectivePosterPath, size: .posterSmall)
                .frame(width: 110, height: 165)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
            Text(item.title)
                .font(.footnote.bold())
                .foregroundStyle(.primary)
                .lineLimit(2)
            Text(item.reason)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
        .frame(width: 110, alignment: .leading)
    }
}

private struct BlindSpotCard: View {
    let item: TasteBlindSpot

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            RemotePosterImage(path: item.effectivePosterPath, size: .posterSmall)
                .frame(width: 110, height: 165)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
            Text(item.title)
                .font(.footnote.bold())
                .foregroundStyle(.primary)
                .lineLimit(2)
            RatingStarsView(rating: item.rating)
        }
        .frame(width: 110, alignment: .leading)
    }
}
