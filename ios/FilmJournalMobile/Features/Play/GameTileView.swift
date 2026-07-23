import SwiftUI
import Kit
import DesignKit

/// Um "quadradinho" colorido representando o resultado de uma pista do palpite (estilo Wordle).
/// Verde = acerto exato, amarelo = perto, cinza = errou.
struct GameTileView: View {
    let label: String
    let value: String
    let grade: TileGrade
    var direction: TileDirection?

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            HStack(spacing: 2) {
                Text(value)
                    .font(.caption.bold())
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                if let direction {
                    Image(systemName: direction == .targetHigher ? "arrow.up" : "arrow.down")
                        .font(.caption2.bold())
                }
            }
        }
        .foregroundStyle(color)
        .padding(.horizontal, Spacing.xs)
        .padding(.vertical, Spacing.sm)
        .frame(maxWidth: .infinity)
        .background(color.opacity(0.22), in: RoundedRectangle(cornerRadius: CornerRadius.small))
    }

    private var color: Color {
        switch grade {
        case .exact: return .green
        case .close: return .yellow
        case .miss: return .gray
        }
    }
}

/// Linha completa com os 6 tiles de um palpite, mais o título/ano/pôster do filme adivinhado.
struct GameGuessRow: View {
    let item: GameViewModel.GuessHistoryItem

    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: Spacing.sm) {
                Text(item.card.title + (item.card.year.map { " (\($0))" } ?? ""))
                    .font(.subheadline.bold())
                if item.correct {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                }
            }
            LazyVGrid(columns: columns, spacing: Spacing.xs) {
                GameTileView(label: "Ano", value: item.tiles.year.guessYear.map(String.init) ?? "?", grade: item.tiles.year.grade, direction: item.tiles.year.direction)
                GameTileView(label: "Gênero", value: genresText, grade: item.tiles.genres.grade)
                GameTileView(label: "Diretor", value: item.tiles.director.guessDirector ?? "?", grade: item.tiles.director.grade)
                GameTileView(label: "Estúdio", value: item.tiles.studio.guessStudio ?? "?", grade: item.tiles.studio.grade)
                GameTileView(label: "Nota", value: item.tiles.rating.guessRating.map { String(format: "%.1f", $0) } ?? "?", grade: item.tiles.rating.grade, direction: item.tiles.rating.direction)
                GameTileView(label: "Elenco", value: item.tiles.cast.guessPrincipal ?? "?", grade: item.tiles.cast.grade)
            }
        }
        .padding(Spacing.sm)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: CornerRadius.medium))
    }

    private var genresText: String {
        item.tiles.genres.guessGenres.isEmpty ? "?" : item.tiles.genres.guessGenres.joined(separator: ", ")
    }
}
