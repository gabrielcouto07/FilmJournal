import SwiftUI
import Kit
import CoordinatorKit
import DesignKit

/// Só edita/exclui sessões existentes; registrar uma nova é pela ficha do filme.
struct DiaryView: View {
    @Environment(\.filmJournalAPI) private var api
    @EnvironmentObject private var root: RootCoordinator
    @StateObject private var viewModel = DiaryViewModel()
    @State private var isShowingFilters = false

    private let posterColumns = [GridItem(.adaptive(minimum: 100, maximum: 140), spacing: Spacing.sm)]

    var body: some View {
        FJScreen("Diário") {
            content
        }
        .searchable(text: $viewModel.searchText, prompt: "Buscar por título, crítica ou tag")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Menu {
                    Picker("Ordenar", selection: $viewModel.sortMode) {
                        ForEach(DiaryViewModel.SortMode.allCases) { mode in
                            Text(mode.label).tag(mode)
                        }
                    }
                    Picker("Visualização", selection: $viewModel.viewMode) {
                        ForEach(DiaryViewModel.ViewMode.allCases) { mode in
                            Label(mode.label, systemImage: mode.systemImage).tag(mode)
                        }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down")
                }
                Button {
                    isShowingFilters = true
                } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                }
            }
        }
        .sheet(isPresented: $isShowingFilters) {
            DiaryFiltersSheet(viewModel: viewModel)
        }
        .sheet(item: $viewModel.editingEntry) { entry in
            LogEditorSheet(
                mode: .edit,
                initialRating: entry.rating,
                initialReview: entry.review ?? "",
                initialWatchedAt: entry.watchedAt ?? Date(),
                initialRewatch: entry.rewatch,
                initialTags: entry.tags ?? "",
                initialFavorite: entry.movie.favorite
            ) { result in
                Task { await viewModel.saveEdit(result, api: api) }
            }
        }
        .alert("Algo deu errado", isPresented: .constant(viewModel.errorMessage != nil), actions: {
            Button("OK") { viewModel.errorMessage = nil }
        }, message: {
            Text(viewModel.errorMessage ?? "")
        })
        .task {
            await viewModel.load(api: api)
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.entries.isEmpty {
            LoadingStateView(message: "Carregando seu diário…")
        } else if let errorMessage = viewModel.errorMessage, viewModel.entries.isEmpty {
            ErrorStateView(message: errorMessage) {
                Task { await viewModel.load(api: api) }
            }
        } else if viewModel.entries.isEmpty {
            ScrollView {
                EmptyStateView(
                    systemImage: "book.closed",
                    title: "Diário vazio",
                    message: "Nenhuma sessão registrada ainda — adicione filmes na aba Explorar e registre por lá."
                )
                .frame(minHeight: 400)
            }
            .refreshable { await viewModel.load(api: api) }
        } else if viewModel.filteredEntries.isEmpty {
            ScrollView {
                EmptyStateView(
                    systemImage: "line.3.horizontal.decrease.circle",
                    title: "Nenhum resultado",
                    message: "Ajuste a busca ou os filtros para ver suas sessões."
                )
                .frame(minHeight: 400)
            }
            .refreshable { await viewModel.load(api: api) }
        } else {
            switch viewModel.viewMode {
            case .list:
                listContent
            case .posters:
                postersContent
            case .calendar:
                calendarContent
            }
        }
    }

    private var listContent: some View {
        List {
            ForEach(viewModel.groupedByMonth) { group in
                Section(group.label) {
                    ForEach(group.entries) { entry in
                        DiaryEntryRow(entry: entry)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                root.diaryRouter.push(.filmDetail(.movieId(entry.movie.id)))
                            }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await viewModel.delete(entry, api: api) }
                                } label: {
                                    Label("Excluir", systemImage: "trash")
                                }
                                Button {
                                    viewModel.editingEntry = entry
                                } label: {
                                    Label("Editar", systemImage: "pencil")
                                }
                                .tint(.blue)
                            }
                    }
                }
            }
        }
        .listStyle(.plain)
        .refreshable { await viewModel.load(api: api) }
    }

    private var postersContent: some View {
        ScrollView {
            LazyVGrid(columns: posterColumns, spacing: Spacing.md) {
                ForEach(viewModel.filteredEntries) { entry in
                    Button {
                        root.diaryRouter.push(.filmDetail(.movieId(entry.movie.id)))
                    } label: {
                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            RemotePosterImage(path: entry.movie.effectivePosterPath, size: .posterSmall)
                                .aspectRatio(2 / 3, contentMode: .fill)
                                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))
                            Text(entry.movie.title)
                                .font(.caption)
                                .lineLimit(2)
                                .foregroundStyle(.primary)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(Spacing.md)
        }
        .refreshable { await viewModel.load(api: api) }
    }

    private var calendarContent: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.lg) {
                ForEach(viewModel.groupedByMonth) { group in
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text(group.label)
                            .font(.headline)
                            .padding(.horizontal, Spacing.md)
                        DiaryMonthCalendar(group: group) { entry in
                            root.diaryRouter.push(.filmDetail(.movieId(entry.movie.id)))
                        }
                        .padding(.horizontal, Spacing.md)
                    }
                }
            }
            .padding(.vertical, Spacing.md)
        }
        .refreshable { await viewModel.load(api: api) }
    }
}

private struct DiaryEntryRow: View {
    let entry: DiaryEntry

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            RemotePosterImage(path: entry.movie.effectivePosterPath, size: .posterSmall)
                .frame(width: 56, height: 84)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small))

            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack(spacing: Spacing.xs) {
                    Text(entry.movie.title).font(.headline)
                    if entry.movie.favorite {
                        Image(systemName: "heart.fill").font(.caption).foregroundStyle(.red)
                    }
                    if entry.rewatch {
                        Image(systemName: "arrow.triangle.2.circlepath").font(.caption).foregroundStyle(.secondary)
                    }
                }

                if let watchedAt = entry.watchedAt {
                    Text(watchedAt.formatted(date: .abbreviated, time: .omitted))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                RatingStarsView(rating: entry.rating)

                if let review = entry.review, !review.isEmpty {
                    Text(review)
                        .font(.footnote)
                        .lineLimit(2)
                        .foregroundStyle(.secondary)
                }

                if !entry.tagList.isEmpty {
                    Text(entry.tagList.joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}

private struct DiaryMonthCalendar: View {
    let group: DiaryViewModel.MonthGroup
    let onSelect: (DiaryEntry) -> Void

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    private var monthDate: Date {
        let parts = group.key.split(separator: "-")
        var components = DateComponents()
        components.year = Int(parts[0])
        components.month = Int(parts[1])
        components.day = 1
        return calendar.date(from: components) ?? Date()
    }

    private var entriesByDay: [Int: [DiaryEntry]] {
        Dictionary(grouping: group.entries) { entry in
            entry.watchedAt.map { calendar.component(.day, from: $0) } ?? 0
        }
    }

    private var daysInMonth: Int {
        calendar.range(of: .day, in: .month, for: monthDate)?.count ?? 30
    }

    /// 0 = domingo — deslocamento de células em branco antes do dia 1.
    private var leadingBlankDays: Int {
        calendar.component(.weekday, from: monthDate) - 1
    }

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

    var body: some View {
        LazyVGrid(columns: columns, spacing: 4) {
            ForEach(0..<leadingBlankDays, id: \.self) { _ in
                Color.clear.frame(height: 44)
            }
            ForEach(1...daysInMonth, id: \.self) { day in
                let dayEntries = entriesByDay[day] ?? []
                Button {
                    if let first = dayEntries.first { onSelect(first) }
                } label: {
                    ZStack(alignment: .bottomTrailing) {
                        if let first = dayEntries.first {
                            RemotePosterImage(path: first.movie.effectivePosterPath, size: .posterSmall)
                                .aspectRatio(2 / 3, contentMode: .fill)
                                .frame(height: 44)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                        } else {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.secondary.opacity(0.08))
                                .frame(height: 44)
                                .overlay(Text("\(day)").font(.caption2).foregroundStyle(.tertiary))
                        }
                        if dayEntries.count > 1 {
                            Text("\(dayEntries.count)")
                                .font(.caption2.bold())
                                .padding(3)
                                .background(.black.opacity(0.6), in: Circle())
                                .foregroundStyle(.white)
                                .padding(2)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(dayEntries.isEmpty)
            }
        }
    }
}

private struct DiaryFiltersSheet: View {
    @ObservedObject var viewModel: DiaryViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Ano") {
                    Picker("Ano", selection: $viewModel.yearFilter) {
                        Text("Todos").tag(Int?.none)
                        ForEach(viewModel.availableYears, id: \.self) { year in
                            Text(String(year)).tag(Int?.some(year))
                        }
                    }
                }

                Section("Nota") {
                    HStack {
                        Text("Mín.")
                        Slider(value: $viewModel.minRating, in: 0...5, step: 0.5)
                        Text(viewModel.minRating, format: .number.precision(.fractionLength(1)))
                    }
                    HStack {
                        Text("Máx.")
                        Slider(value: $viewModel.maxRating, in: 0...5, step: 0.5)
                        Text(viewModel.maxRating, format: .number.precision(.fractionLength(1)))
                    }
                }

                Section("Crítica") {
                    Picker("Tem crítica?", selection: $viewModel.reviewedFilter) {
                        Text("Tanto faz").tag(DiaryViewModel.TriState.any)
                        Text("Com crítica").tag(DiaryViewModel.TriState.yes)
                        Text("Sem crítica").tag(DiaryViewModel.TriState.no)
                    }
                }

                Section("Rewatch") {
                    Picker("É rewatch?", selection: $viewModel.rewatchFilter) {
                        Text("Tanto faz").tag(DiaryViewModel.TriState.any)
                        Text("Só rewatches").tag(DiaryViewModel.TriState.yes)
                        Text("Só primeira vez").tag(DiaryViewModel.TriState.no)
                    }
                }

                Section("Gênero") {
                    Picker("Gênero", selection: $viewModel.genreFilter) {
                        Text("Todos").tag(String?.none)
                        ForEach(viewModel.availableGenres, id: \.self) { genre in
                            Text(genre).tag(String?.some(genre))
                        }
                    }
                }

                Section {
                    Toggle("Só favoritos", isOn: $viewModel.favoriteOnly)
                }
            }
            .navigationTitle("Filtros")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Concluído") { dismiss() }
                }
            }
        }
    }
}
