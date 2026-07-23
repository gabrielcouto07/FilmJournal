import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Jogo "Cine-Detetive" (estilo Wordle) — adivinhe o filme secreto a partir de pistas de
/// elenco/pôster/ano/gênero/diretor/estúdio/nota, reveladas conforme os palpites avançam.
/// Toda a lógica de regras roda no backend; esta tela só orquestra as chamadas.
struct GameView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = GameViewModel()

    var body: some View {
        content
            .task {
                await viewModel.loadScores(api: api)
            }
            .alert("Algo deu errado", isPresented: .constant(viewModel.errorMessage != nil), actions: {
                Button("OK") { viewModel.errorMessage = nil }
            }, message: {
                Text(viewModel.errorMessage ?? "")
            })
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .selectingSource:
            SourceSelectionView(viewModel: viewModel, api: api)
        case .loading:
            LoadingStateView(message: "Preparando rodada...")
        case .playing:
            PlayingRoundView(viewModel: viewModel, api: api, root: root)
        case .finished(let won):
            RoundFinishedView(viewModel: viewModel, api: api, root: root, won: won)
        }
    }
}

// MARK: - Seleção de fonte

private struct SourceSelectionView: View {
    @ObservedObject var viewModel: GameViewModel
    let api: FilmJournalAPI

    var body: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "theatermasks")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("Cine-Detetive")
                .font(.title2.bold())
            Text("Adivinhe o filme secreto a partir das pistas de elenco, pôster e mais.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Picker("Fonte", selection: $viewModel.selectedSource) {
                Text("Meus filmes").tag(PlaySource.mine)
                Text("Populares").tag(PlaySource.popular)
                Text("Filme do dia").tag(PlaySource.daily)
            }
            .pickerStyle(.segmented)

            if let best = viewModel.bestScoreForSelectedSource {
                Text("Recorde: \(best.bestScore) pts em \(best.bestRounds) palpite(s)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Button {
                Task { await viewModel.startRound(source: viewModel.selectedSource, api: api) }
            } label: {
                Text("Começar rodada")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onChange(of: viewModel.selectedSource) { _ in
            Task { await viewModel.loadScores(api: api) }
        }
    }
}

// MARK: - Rodada em andamento

private struct PlayingRoundView: View {
    @ObservedObject var viewModel: GameViewModel
    let api: FilmJournalAPI
    let root: RootCoordinator

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                HStack {
                    Text("Palpite \(min(viewModel.maxGuesses - viewModel.guessesRemaining + 1, viewModel.maxGuesses)) de \(viewModel.maxGuesses)")
                        .font(.footnote.bold())
                    Spacer()
                    Button("Desistir", role: .destructive) {
                        Task { await viewModel.giveUp(api: api) }
                    }
                    .font(.footnote)
                }

                posterSection
                actorsSection
                searchSection
                hintsSection

                if !viewModel.guessHistory.isEmpty {
                    Text("Palpites anteriores")
                        .font(.headline)
                    ForEach(viewModel.guessHistory) { item in
                        GameGuessRow(item: item)
                    }
                }
            }
            .padding(Spacing.md)
        }
    }

    @ViewBuilder
    private var posterSection: some View {
        if let poster = viewModel.poster {
            RemotePosterImage(path: poster.path, size: .posterMedium)
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium))
                .blur(radius: blurRadius(for: poster.stage))
                .frame(maxWidth: .infinity)
        }
    }

    private func blurRadius(for stage: PlayPosterStage) -> CGFloat {
        switch stage {
        case .heavy: return 20
        case .medium: return 10
        case .light: return 3
        }
    }

    private var actorsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Elenco (\(viewModel.actors.count) de \(viewModel.castTotal))")
                .font(.headline)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.md) {
                    ForEach(viewModel.actors) { actor in
                        VStack(spacing: Spacing.xs) {
                            RemotePosterImage(path: actor.profilePath, size: .profile)
                                .frame(width: 56, height: 56)
                                .clipShape(Circle())
                            Text(actor.name)
                                .font(.caption2)
                                .lineLimit(1)
                                .frame(width: 64)
                        }
                    }
                }
            }
        }
    }

    private var searchSection: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("Seu palpite")
                .font(.headline)
            TextField("Título do filme", text: $viewModel.query)
                .textFieldStyle(.roundedBorder)
                .disabled(viewModel.isSubmittingGuess)
                .task(id: viewModel.query) {
                    try? await Task.sleep(for: .milliseconds(350))
                    if Task.isCancelled { return }
                    await viewModel.searchTitles(api: api)
                }

            if !viewModel.suggestions.isEmpty {
                VStack(spacing: 0) {
                    ForEach(viewModel.suggestions) { suggestion in
                        Button {
                            Task { await viewModel.submitGuess(suggestion, api: api) }
                        } label: {
                            HStack {
                                Text(suggestion.title)
                                if let year = suggestion.year {
                                    Text("(\(year))")
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding(Spacing.sm)
                        }
                        .buttonStyle(.plain)
                        Divider()
                    }
                }
                .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: CornerRadius.small))
            }

            if viewModel.isSubmittingGuess {
                ProgressView()
            }
        }
    }

    private var hintsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("Dicas extras")
                .font(.headline)

            HStack(spacing: Spacing.md) {
                Button("Palavras-chave") {
                    Task { await viewModel.fetchKeywordsHint(api: api) }
                }
                .disabled(!viewModel.keywordsHintAvailable || viewModel.keywordsHint != nil)

                Button("Frase de efeito") {
                    Task { await viewModel.fetchTaglineHint(api: api) }
                }
                .disabled(!viewModel.taglineHintAvailable || viewModel.hasFetchedTagline)
            }
            .buttonStyle(.bordered)
            .font(.footnote)

            if let keywords = viewModel.keywordsHint, !keywords.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.xs) {
                        ForEach(keywords, id: \.self) { keyword in
                            Text(keyword)
                                .font(.caption2)
                                .padding(.horizontal, Spacing.sm)
                                .padding(.vertical, 4)
                                .background(Color.accentColor.opacity(0.15), in: Capsule())
                        }
                    }
                }
            }

            if let tagline = viewModel.taglineHint, !tagline.isEmpty {
                Text("\u{201C}\(tagline)\u{201D}")
                    .font(.footnote.italic())
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Fim de rodada

private struct RoundFinishedView: View {
    @ObservedObject var viewModel: GameViewModel
    let api: FilmJournalAPI
    let root: RootCoordinator
    let won: Bool

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.md) {
                Text(won ? "Você acertou!" : "Não foi dessa vez")
                    .font(.title2.bold())

                if let answer = viewModel.answer {
                    RemotePosterImage(path: answer.posterPath, size: .posterMedium)
                        .frame(height: 260)
                        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium))

                    Text(answer.title + (answer.year.map { " (\($0))" } ?? ""))
                        .font(.headline)

                    if let tagline = answer.tagline, !tagline.isEmpty {
                        Text(tagline).font(.footnote.italic()).foregroundStyle(.secondary)
                    }
                    if let director = answer.directorName {
                        Text("Direção: \(director)").font(.footnote)
                    }
                    if !answer.genres.isEmpty {
                        Text(answer.genres.joined(separator: ", ")).font(.footnote).foregroundStyle(.secondary)
                    }
                    if !answer.cast.isEmpty {
                        Text("Elenco: " + answer.cast.joined(separator: ", "))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if let score = viewModel.lastScore {
                    Text(won ? "Pontuação: \(score) pts" : "Pontuação: 0 pts")
                        .font(.headline)
                    if won, let improved = viewModel.lastScoreImproved, improved {
                        Text("Novo recorde!")
                            .font(.footnote.bold())
                            .foregroundStyle(.green)
                    }
                }
                if let best = viewModel.bestScoreForSelectedSource {
                    Text("Recorde nesta fonte: \(best.bestScore) pts")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: Spacing.sm) {
                    Button {
                        Task { await viewModel.playAgain(api: api) }
                    } label: {
                        Text("Jogar de novo").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)

                    if let answer = viewModel.answer {
                        Button {
                            root.playRouter.push(.filmDetail(.tmdb(answer.tmdbId)))
                        } label: {
                            Text("Ver ficha do filme").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            .padding(Spacing.lg)
        }
    }
}
