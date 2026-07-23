import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Ficha do filme — tela compartilhada por Diário, Coleção, Busca, Descobrir e Roleta.
/// Layout intencionalmente simples (sem estilização fina): a UI final é responsabilidade do
/// restante do time; aqui garantimos que os dados e as ações já funcionam de ponta a ponta.
struct FilmDetailView: View {
    let target: FilmDetailTarget

    @Environment(\.filmJournalAPI) private var api
    @StateObject private var viewModel = FilmDetailViewModel()
    @State private var isShowingLogSheet = false

    var body: some View {
        FJScreen(viewModel.displayTitle, displayMode: .inline) {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                RemotePosterImage(path: viewModel.tmdbDetails?.backdropPath ?? viewModel.movie?.effectiveBackdropPath, size: .backdropMedium)
                    .frame(height: 200)
                    .clipped()

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Text(viewModel.displayTitle)
                        .font(.title2.bold())

                    metadataLine

                    RatingStarsView(rating: viewModel.movie?.rating)

                    actionButtons

                    if let overview = viewModel.tmdbDetails?.overview ?? viewModel.movie?.overview, !overview.isEmpty {
                        Text(overview)
                            .font(.body)
                            .padding(.top, Spacing.sm)
                    }

                    if !viewModel.recentLogs.isEmpty {
                        Text("Sessões registradas")
                            .font(.headline)
                            .padding(.top, Spacing.md)
                        ForEach(viewModel.recentLogs) { log in
                            LogRow(log: log)
                        }
                    }
                }
                .padding(.horizontal, Spacing.md)
            }
        }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    isShowingLogSheet = true
                } label: {
                    Image(systemName: "plus.circle")
                }
            }
        }
        .sheet(isPresented: $isShowingLogSheet) {
            LogSessionSheet { rating, review, watchedAt in
                Task { await viewModel.logSession(rating: rating, review: review, watchedAt: watchedAt, api: api) }
            }
        }
        .overlay {
            if viewModel.isLoading {
                LoadingStateView()
            }
        }
        .alert("Algo deu errado", isPresented: .constant(viewModel.errorMessage != nil), actions: {
            Button("OK") { viewModel.errorMessage = nil }
        }, message: {
            Text(viewModel.errorMessage ?? "")
        })
        .task {
            await viewModel.load(target: target, api: api)
        }
    }

    private var metadataLine: some View {
        let year = viewModel.movie?.year ?? viewModel.tmdbDetails?.releaseDate.flatMap { Int($0.prefix(4)) }
        let runtime = viewModel.movie?.runtime ?? viewModel.tmdbDetails?.runtime
        var parts: [String] = []
        if let year { parts.append(String(year)) }
        if let runtime { parts.append("\(runtime) min") }
        return Text(parts.joined(separator: " · "))
            .font(.subheadline)
            .foregroundStyle(.secondary)
    }

    private var actionButtons: some View {
        HStack(spacing: Spacing.md) {
            Button {
                Task { await viewModel.toggleWatchlist(api: api) }
            } label: {
                Label("Watchlist", systemImage: (viewModel.movie?.watchlist ?? false) ? "bookmark.fill" : "bookmark")
            }

            Button {
                Task { await viewModel.toggleFavorite(api: api) }
            } label: {
                Label("Favorito", systemImage: (viewModel.movie?.favorite ?? false) ? "heart.fill" : "heart")
            }

            Button {
                Task { await viewModel.toggleTop10(api: api) }
            } label: {
                Label("Top 10", systemImage: viewModel.movie?.favoriteRank != nil ? "star.fill" : "star")
            }
        }
        .disabled(viewModel.isMutating)
        .buttonStyle(.bordered)
    }
}

private struct LogRow: View {
    let log: LogEntry

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack {
                if let watchedAt = log.watchedAt {
                    Text(watchedAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                RatingStarsView(rating: log.rating)
            }
            if let review = log.review, !review.isEmpty {
                Text(review).font(.footnote)
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}

/// Formulário simples para registrar uma nova sessão — inline (sheet) em vez de uma rota
/// própria, já que `FilmDetailView` é reaproveitada por rotas de várias abas diferentes.
private struct LogSessionSheet: View {
    let onSave: (Double?, String?, Date?) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var rating: Double = 3
    @State private var review = ""
    @State private var watchedAt = Date()

    var body: some View {
        NavigationStack {
            FJScreen("Registrar sessão", displayMode: .inline) {
            Form {
                DatePicker("Assistido em", selection: $watchedAt, displayedComponents: .date)
                Stepper(value: $rating, in: Rating.range, step: Rating.step) {
                    HStack {
                        Text("Nota")
                        Spacer()
                        Text(rating, format: .number.precision(.fractionLength(1)))
                    }
                }
                TextField("Crítica (opcional)", text: $review, axis: .vertical)
                    .lineLimit(3...8)
            }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        onSave(rating, review.isEmpty ? nil : review, watchedAt)
                        dismiss()
                    }
                }
            }
        }
    }
}
