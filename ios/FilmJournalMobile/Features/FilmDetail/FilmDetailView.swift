import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

struct FilmDetailView: View {
    let target: FilmDetailTarget

    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var session: SessionController
    @StateObject private var viewModel = FilmDetailViewModel()
    @State private var isShowingLogSheet = false
    @State private var artworkPickerKind: ArtworkPickerSheet.Kind?

    private var isOwner: Bool { session.currentUser?.isOwner ?? false }

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

                    if let movie = viewModel.movie {
                        AddToListButton(movieId: movie.id)
                    }

                    externalLinks

                    if isOwner, let images = viewModel.tmdbDetails?.images, !(images.posters.isEmpty && images.backdrops.isEmpty) {
                        artworkButtons(images: images)
                    }

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
                            LogRow(log: log) {
                                viewModel.editingLog = log
                            } onDelete: {
                                Task { await viewModel.deleteLog(log, api: api) }
                            }
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
            LogEditorSheet(mode: .create, initialFavorite: viewModel.movie?.favorite ?? false) { result in
                Task { await viewModel.logSession(result, api: api) }
            }
        }
        .sheet(item: $viewModel.editingLog) { log in
            LogEditorSheet(
                mode: .edit,
                initialRating: log.rating,
                initialReview: log.review ?? "",
                initialWatchedAt: log.watchedAt ?? Date(),
                initialRewatch: log.rewatch,
                initialTags: log.tags ?? "",
                initialFavorite: viewModel.movie?.favorite ?? false
            ) { result in
                Task { await viewModel.saveLogEdit(result, api: api) }
            }
        }
        .sheet(item: $artworkPickerKind) { kind in
            ArtworkPickerSheet(kind: kind, images: viewModel.tmdbDetails?.images) { path in
                Task {
                    switch kind {
                    case .poster: await viewModel.setPoster(path: path, api: api)
                    case .backdrop: await viewModel.setBackdrop(path: path, api: api)
                    }
                }
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

    @ViewBuilder
    private var externalLinks: some View {
        HStack(spacing: Spacing.md) {
            if let imdbId = viewModel.movie?.imdbId, let url = URL(string: "https://www.imdb.com/title/\(imdbId)/") {
                Link(destination: url) {
                    Label("IMDb", systemImage: "arrow.up.right.square")
                }
            }
            if let letterboxdUri = viewModel.movie?.letterboxdUri, let url = URL(string: letterboxdUri) {
                Link(destination: url) {
                    Label("Letterboxd", systemImage: "arrow.up.right.square")
                }
            }
        }
        .font(.footnote)
    }

    private func artworkButtons(images: TmdbMovieDetails.Images) -> some View {
        HStack(spacing: Spacing.md) {
            if !images.posters.isEmpty {
                Button("Alterar pôster") { artworkPickerKind = .poster }
            }
            if !images.backdrops.isEmpty {
                Button("Alterar capa") { artworkPickerKind = .backdrop }
            }
        }
        .font(.footnote)
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
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack {
                if let watchedAt = log.watchedAt {
                    Text(watchedAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                RatingStarsView(rating: log.rating)
                if log.rewatch {
                    Image(systemName: "arrow.triangle.2.circlepath").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Menu {
                    Button("Editar", systemImage: "pencil", action: onEdit)
                    Button("Excluir", systemImage: "trash", role: .destructive, action: onDelete)
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .foregroundStyle(.secondary)
                }
            }
            if let review = log.review, !review.isEmpty {
                Text(review).font(.footnote)
            }
            if let tags = log.tags, !tags.isEmpty {
                Text(tags).font(.caption2).foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}

/// Só o `OWNER` troca a arte, porque o catálogo de filmes é compartilhado entre todos.
private struct ArtworkPickerSheet: View {
    enum Kind: String, Identifiable {
        case poster
        case backdrop
        var id: String { rawValue }
    }

    let kind: Kind
    let images: TmdbMovieDetails.Images?
    let onSelect: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    private let columns = [GridItem(.adaptive(minimum: 90, maximum: 140), spacing: Spacing.sm)]

    private var options: [TmdbPoster] {
        switch kind {
        case .poster: return images?.posters ?? []
        case .backdrop: return images?.backdrops ?? []
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: Spacing.sm) {
                    ForEach(options, id: \.filePath) { option in
                        Button {
                            onSelect(option.filePath)
                            dismiss()
                        } label: {
                            RemotePosterImage(path: option.filePath, size: kind == .poster ? .posterSmall : .backdropMedium)
                                .aspectRatio(kind == .poster ? 2 / 3 : 16 / 9, contentMode: .fill)
                                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(Spacing.md)
            }
            .navigationTitle(kind == .poster ? "Escolher pôster" : "Escolher capa")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fechar") { dismiss() }
                }
            }
        }
    }
}
