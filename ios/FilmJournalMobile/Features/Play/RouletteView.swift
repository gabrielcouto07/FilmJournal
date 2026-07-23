import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Roleta de filmes: monta um pool com filtros (fonte, gêneros, pessoas, ano, duração) e sorteia
/// um filme por vez a partir dele. "Sortear outro" apenas avança pelo array já buscado — sem
/// nova chamada de rede — simulando a experiência de roleta sem precisar de animação sofisticada.
struct RouletteView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = RouletteViewModel()
    @State private var isShowingFilters = false

    var body: some View {
        FJScreen("Roleta") {
            ScrollView {
                VStack(spacing: Spacing.md) {
                    if viewModel.isLoadingFilters {
                        LoadingStateView(message: "Carregando filtros...")
                    } else if let errorMessage = viewModel.errorMessage {
                        ErrorStateView(message: errorMessage) {
                            Task { await viewModel.loadFilters(api: api) }
                        }
                    } else {
                        filtersSection
                        resultSection
                        spinButton
                    }
                }
                .padding(Spacing.md)
            }
        }
        .task {
            await viewModel.loadFilters(api: api)
        }
    }

    private var filtersSection: some View {
        DisclosureGroup("Filtros", isExpanded: $isShowingFilters) {
            RouletteFiltersView(viewModel: viewModel)
                .padding(.top, Spacing.sm)
        }
        .padding(Spacing.sm)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: CornerRadius.medium))
    }

    @ViewBuilder
    private var resultSection: some View {
        if viewModel.isSpinning {
            LoadingStateView(message: "Sorteando...")
        } else if let movie = viewModel.currentMovie {
            RouletteResultCard(movie: movie) {
                root.playRouter.push(.filmDetail(.tmdb(movie.id)))
            }
            HStack {
                Button("Sortear outro") { viewModel.nextMovie() }
                    .disabled(!viewModel.hasMoreInPool)
                Spacer()
                Text("\(viewModel.currentIndex + 1) de \(viewModel.pool.count)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        } else if viewModel.totalResults == 0 && !viewModel.pool.isEmpty {
            EmptyStateView(systemImage: "dice", title: "Nenhum filme encontrado", message: "Ajuste os filtros e tente de novo.")
        }
    }

    private var spinButton: some View {
        Button {
            Task { await viewModel.spin(api: api) }
        } label: {
            Label(viewModel.pool.isEmpty ? "Girar a roleta" : "Girar de novo", systemImage: "dice.fill")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(viewModel.isSpinning)
    }
}

private struct RouletteResultCard: View {
    let movie: RoulettePoolMovie
    let onOpenDetail: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            RemotePosterImage(path: movie.posterPath, size: .posterMedium)
                .frame(height: 320)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium))
                .frame(maxWidth: .infinity)

            Text(movie.title + (movie.year.map { " (\($0))" } ?? ""))
                .font(.title3.bold())

            if let rating = movie.rating {
                HStack(spacing: 2) {
                    Image(systemName: "star.fill").font(.caption2).foregroundStyle(.yellow)
                    Text(rating, format: .number.precision(.fractionLength(1)))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            if let gapLabel = movie.gapLabel, !gapLabel.isEmpty {
                Text(gapLabel)
                    .font(.caption2.bold())
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 4)
                    .background(Color.accentColor.opacity(0.15), in: Capsule())
                    .foregroundStyle(Color.accentColor)
            }

            if let rationale = movie.rationale, !rationale.isEmpty {
                Text(rationale)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if let overview = movie.overview, !overview.isEmpty {
                Text(overview)
                    .font(.footnote)
                    .lineLimit(4)
            }

            Button("Ver ficha completa", action: onOpenDetail)
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
        }
    }
}

private struct RouletteFiltersView: View {
    @ObservedObject var viewModel: RouletteViewModel
    @Environment(\.filmJournalAPI) private var api

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Picker("Fonte", selection: $viewModel.source) {
                Text("Populares").tag(RouletteSource.popular)
                Text("Watchlist").tag(RouletteSource.watchlist)
                Text("Pontos cegos").tag(RouletteSource.blindspots)
            }
            .pickerStyle(.segmented)

            if !viewModel.availableGenres.isEmpty {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Gêneros").font(.footnote.bold())
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.xs) {
                            ForEach(viewModel.availableGenres) { genre in
                                GenreChip(
                                    title: genre.name,
                                    isSelected: viewModel.selectedGenreIds.contains(genre.id)
                                ) {
                                    if viewModel.selectedGenreIds.contains(genre.id) {
                                        viewModel.selectedGenreIds.remove(genre.id)
                                    } else {
                                        viewModel.selectedGenreIds.insert(genre.id)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Pessoas (elenco/direção)").font(.footnote.bold())
                TextField("Buscar nome...", text: $viewModel.peopleQuery)
                    .textFieldStyle(.roundedBorder)
                    .task(id: viewModel.peopleQuery) {
                        try? await Task.sleep(for: .milliseconds(350))
                        if Task.isCancelled { return }
                        await viewModel.searchPeople(api: api)
                    }

                if !viewModel.peopleSuggestions.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(viewModel.peopleSuggestions) { person in
                            Button {
                                viewModel.addPerson(person)
                            } label: {
                                HStack {
                                    Text(person.name)
                                    if let department = person.department {
                                        Text(department).font(.caption2).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                }
                                .padding(Spacing.xs)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: CornerRadius.small))
                }

                if !viewModel.selectedPeople.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Spacing.xs) {
                            ForEach(viewModel.selectedPeople) { person in
                                GenreChip(title: person.name, isSelected: true) {
                                    viewModel.removePerson(person)
                                }
                            }
                        }
                    }
                }
            }

            HStack(spacing: Spacing.md) {
                VStack(alignment: .leading) {
                    Text("Ano de").font(.footnote.bold())
                    TextField("ex. 1990", text: $viewModel.yearFrom)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                }
                VStack(alignment: .leading) {
                    Text("Ano até").font(.footnote.bold())
                    TextField("ex. 2020", text: $viewModel.yearTo)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Duração máxima: \(Int(viewModel.runtimeMax)) min").font(.footnote.bold())
                Slider(value: $viewModel.runtimeMax, in: 60...240, step: 5)
            }

            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text("Tamanho do sorteio").font(.footnote.bold())
                Picker("Quantidade", selection: $viewModel.count) {
                    Text("4").tag(4)
                    Text("8").tag(8)
                    Text("16").tag(16)
                }
                .pickerStyle(.segmented)
            }

            Button {
                Task { await viewModel.savePrefs(api: api) }
            } label: {
                HStack {
                    Text("Salvar filtros")
                    if viewModel.isSavingPrefs {
                        ProgressView()
                    } else if viewModel.didSavePrefs {
                        Image(systemName: "checkmark")
                    }
                }
            }
            .buttonStyle(.bordered)
        }
    }
}

private struct GenreChip: View {
    let title: String
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, 4)
                .background(isSelected ? Color.accentColor.opacity(0.25) : Color.secondary.opacity(0.12), in: Capsule())
                .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
        }
        .buttonStyle(.plain)
    }
}
