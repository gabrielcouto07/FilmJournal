import SwiftUI
import Kit
import DesignKit

/// Estado completo do formulário; quem chama decide o que vai pra rede.
struct LogEditorResult {
    var rating: Double?
    var review: String?
    var watchedAt: Date
    var rewatch: Bool
    var tags: String?
    var favorite: Bool
}

/// Formulário de sessão usado tanto na criação (Ficha do Filme) quanto na edição (Diário).
struct LogEditorSheet: View {
    enum Mode {
        case create
        case edit
    }

    let mode: Mode
    let onSave: (LogEditorResult) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var hasRating: Bool
    @State private var rating: Double
    @State private var review: String
    @State private var watchedAt: Date
    @State private var rewatch: Bool
    @State private var tags: String
    @State private var favorite: Bool

    init(
        mode: Mode,
        initialRating: Double? = nil,
        initialReview: String = "",
        initialWatchedAt: Date = Date(),
        initialRewatch: Bool = false,
        initialTags: String = "",
        initialFavorite: Bool = false,
        onSave: @escaping (LogEditorResult) -> Void
    ) {
        self.mode = mode
        self.onSave = onSave
        _hasRating = State(initialValue: initialRating != nil)
        _rating = State(initialValue: initialRating ?? 3)
        _review = State(initialValue: initialReview)
        _watchedAt = State(initialValue: initialWatchedAt)
        _rewatch = State(initialValue: initialRewatch)
        _tags = State(initialValue: initialTags)
        _favorite = State(initialValue: initialFavorite)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Assistido em", selection: $watchedAt, displayedComponents: .date)

                    Toggle("Nota", isOn: $hasRating)
                    if hasRating {
                        Stepper(value: $rating, in: Rating.range, step: Rating.step) {
                            HStack {
                                Text("Nota")
                                Spacer()
                                Text(rating, format: .number.precision(.fractionLength(1)))
                            }
                        }
                    }

                    Toggle("Favorito", isOn: $favorite)
                    Toggle("Já tinha assistido antes (rewatch)", isOn: $rewatch)
                }

                Section("Crítica") {
                    TextField("Crítica (opcional)", text: $review, axis: .vertical)
                        .lineLimit(3...8)
                }

                Section("Tags") {
                    TextField("Separadas por vírgula (opcional)", text: $tags)
                }
            }
            .navigationTitle(mode == .create ? "Registrar sessão" : "Editar sessão")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salvar") {
                        onSave(LogEditorResult(
                            rating: hasRating ? rating : nil,
                            review: review.isEmpty ? nil : review,
                            watchedAt: watchedAt,
                            rewatch: rewatch,
                            tags: tags.isEmpty ? nil : tags,
                            favorite: favorite
                        ))
                        dismiss()
                    }
                }
            }
        }
    }
}
