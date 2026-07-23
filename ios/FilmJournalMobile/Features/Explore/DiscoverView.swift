import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Pontos cegos do acervo — sugestões de filmes para preencher lacunas de década, país, idioma
/// ou gênero (`GET /api/discover`).
struct DiscoverView: View {
    let initialDimension: GapDimension?

    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel: DiscoverViewModel

    init(initialDimension: GapDimension?) {
        self.initialDimension = initialDimension
        _viewModel = StateObject(wrappedValue: DiscoverViewModel(initialDimension: initialDimension))
    }

    var body: some View {
        FJScreen("Descobrir") {
            VStack(spacing: 0) {
                Picker("Dimensão", selection: $viewModel.dimension) {
                    Text("Automático").tag(GapDimension?.none)
                    ForEach(GapDimension.allCases, id: \.self) { dimension in
                        Text(dimension.label).tag(GapDimension?.some(dimension))
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)

                if viewModel.degraded {
                    Text("Alguns dados podem estar incompletos agora.")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                        .padding(.horizontal, Spacing.md)
                        .padding(.bottom, Spacing.sm)
                }

                content
            }
        }
        .task(id: viewModel.dimension) {
            await viewModel.load(api: api)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            LoadingStateView(message: "Procurando pontos cegos...")
        } else if let errorMessage = viewModel.errorMessage {
            ErrorStateView(message: errorMessage) {
                Task { await viewModel.load(api: api) }
            }
        } else if viewModel.picks.isEmpty {
            EmptyStateView(
                systemImage: "sparkle.magnifyingglass",
                title: "Nada por aqui",
                message: "Não encontramos pontos cegos para essa dimensão agora."
            )
        } else {
            List {
                ForEach(viewModel.picks) { pick in
                    Button {
                        root.exploreRouter.push(.filmDetail(.tmdb(pick.movie.tmdbId)))
                    } label: {
                        BlindSpotRow(pick: pick)
                    }
                    .buttonStyle(.plain)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            Task { await viewModel.dismiss(pick, api: api) }
                        } label: {
                            Label("Não me interessa", systemImage: "hand.thumbsdown")
                        }
                    }
                    .opacity(viewModel.dismissingGapKeys.contains(pick.gapKey) ? 0.4 : 1)
                }
            }
            .listStyle(.plain)
        }
    }
}

private extension GapDimension {
    var label: String {
        switch self {
        case .decade: return "Década"
        case .country: return "País"
        case .language: return "Idioma"
        case .genre: return "Gênero"
        }
    }
}

private struct BlindSpotRow: View {
    let pick: BlindSpotPick

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            RemotePosterImage(path: pick.movie.posterPath, size: .posterMedium)
                .frame(width: 72, height: 108)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(pick.movie.title)
                    .font(.headline)

                Text(pick.gapLabel)
                    .font(.caption.bold())
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.15), in: Capsule())
                    .foregroundStyle(Color.accentColor)

                Text(pick.rationale)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
