import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Diário — lista de sessões (`LogEntry`) já registradas pelo usuário. O registro de uma nova
/// sessão acontece de dentro de `FilmDetailView` (botão "+"), não aqui.
struct DiaryView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = DiaryViewModel()

    var body: some View {
        FJScreen("Diário") {
            content
        }
        .task {
            await viewModel.load(api: api)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.logs.isEmpty {
            LoadingStateView(message: "Carregando seu diário…")
        } else if let errorMessage = viewModel.errorMessage, viewModel.logs.isEmpty {
            ErrorStateView(message: errorMessage) {
                Task { await viewModel.load(api: api) }
            }
        } else if viewModel.logs.isEmpty {
            ScrollView {
                EmptyStateView(
                    systemImage: "book.closed",
                    title: "Diário vazio",
                    message: "Nenhuma sessão registrada ainda — adicione filmes na aba Explorar e registre por lá."
                )
                .frame(minHeight: 400)
            }
            .refreshable {
                await viewModel.load(api: api)
            }
        } else {
            List(viewModel.logs) { log in
                LogEntryRow(log: log)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if let movie = log.movie {
                            root.diaryRouter.push(.filmDetail(.local(movie)))
                        }
                    }
            }
            .listStyle(.plain)
            .refreshable {
                await viewModel.load(api: api)
            }
        }
    }
}

private struct LogEntryRow: View {
    let log: LogEntry

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            RemotePosterImage(path: log.movie?.effectivePosterPath, size: .posterSmall)
                .frame(width: 56, height: 84)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(log.movie?.title ?? "Filme removido")
                    .font(.headline)

                if let watchedAt = log.watchedAt {
                    Text(watchedAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                RatingStarsView(rating: log.rating)

                if let review = log.review, !review.isEmpty {
                    Text(review)
                        .font(.footnote)
                        .lineLimit(2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}
