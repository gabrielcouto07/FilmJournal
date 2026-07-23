import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Segundo passo do onboarding — busca no TMDB e seleção de até 5 filmes favoritos com nota,
/// enviados via `POST /api/onboarding` (ver `OnboardingViewModel`).
struct PickFavoritesView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = OnboardingViewModel()

    var body: some View {
        FJScreen("Seus favoritos") {
            VStack(spacing: 0) {
                selectedSection

                List {
                    if viewModel.isSearching {
                        ProgressView()
                    } else if viewModel.results.isEmpty && !viewModel.query.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text("Nenhum resultado.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(viewModel.results) { result in
                        Button {
                            viewModel.toggle(result)
                        } label: {
                            searchRow(result)
                        }
                        .buttonStyle(.plain)
                        .disabled(!viewModel.isSelected(result.id) && !viewModel.canAddMore)
                    }
                }
                .listStyle(.plain)
            }
        }
        .searchable(text: $viewModel.query, prompt: "Buscar título do filme")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                if viewModel.isSubmitting {
                    ProgressView()
                } else {
                    Button("Concluir") {
                        Task {
                            if await viewModel.submit(api: api) {
                                root.homeRouter.popToRoot()
                            }
                        }
                    }
                    .disabled(viewModel.selectedFilms.isEmpty)
                }
            }
        }
        .alert("Algo deu errado", isPresented: .constant(viewModel.errorMessage != nil), actions: {
            Button("OK") { viewModel.errorMessage = nil }
        }, message: {
            Text(viewModel.errorMessage ?? "")
        })
        .task(id: viewModel.query) {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await viewModel.search(api: api)
        }
    }

    @ViewBuilder
    private var selectedSection: some View {
        if !viewModel.selectedFilms.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("Selecionados (\(viewModel.selectedFilms.count)/5)")
                    .font(.subheadline.bold())
                    .padding(.horizontal, Spacing.md)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: Spacing.md) {
                        ForEach(viewModel.selectedFilms) { film in
                            selectedCard(film)
                        }
                    }
                    .padding(.horizontal, Spacing.md)
                }
            }
            .padding(.vertical, Spacing.sm)
            Divider()
        }
    }

    private func selectedCard(_ film: OnboardingViewModel.SelectedFilm) -> some View {
        VStack(spacing: Spacing.xs) {
            RemotePosterImage(path: film.posterPath, size: .posterSmall)
                .frame(width: 84, height: 126)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
            Text(film.title)
                .font(.caption2)
                .lineLimit(1)
                .frame(width: 84)
            Stepper(
                value: Binding(
                    get: { film.rating },
                    set: { viewModel.updateRating(tmdbId: film.tmdbId, rating: $0) }
                ),
                in: Rating.range,
                step: Rating.step
            ) {
                Text(film.rating, format: .number.precision(.fractionLength(1)))
                    .font(.caption2)
            }
            .labelsHidden()
            .frame(width: 84)
            Button("Remover") {
                viewModel.remove(tmdbId: film.tmdbId)
            }
            .font(.caption2)
        }
    }

    private func searchRow(_ result: TmdbMovieSearchResult) -> some View {
        HStack(spacing: Spacing.sm) {
            RemotePosterImage(path: result.posterPath, size: .posterSmall)
                .frame(width: 40, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(result.title)
                if let year = result.year {
                    Text(String(year)).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Image(systemName: viewModel.isSelected(result.id) ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(viewModel.isSelected(result.id) ? Color.accentColor : Color.secondary)
        }
        .contentShape(Rectangle())
    }
}
