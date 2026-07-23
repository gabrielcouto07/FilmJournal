import SwiftUI
import Charts
import Kit
import DesignKit

/// Espelha `GenreShareDrift` em `EvolutionCharts.tsx` — participação (%) dos principais gêneros
/// entre os filmes assistidos, ano a ano. Só faz sentido com diário em 2+ anos e 2+ gêneros
/// recorrentes; seu uso na Home fica comentado por padrão em `HomeChartsSection.swift` —
/// descomente lá para testar.
struct GenreShareDriftChart: View {
    let years: [TimelineYear]
    let genres: [String]

    private static let colors: [Color] = [.fjAccent, .fjBlue, .fjAccent.opacity(0.55), .fjViolet, Color(hex: "#6b655c")]

    private func color(forGenreIndex index: Int) -> Color { Self.colors[index % Self.colors.count] }

    /// `nil` = sem registros naquele ano (lacuna); `0` = com registros mas sem esse gênero.
    private func share(for year: TimelineYear, genre: String) -> Double? {
        guard !year.genreShares.isEmpty else { return nil }
        let value = year.genreShares.first(where: { $0.genre == genre })?.share ?? 0
        return (value * 100).rounded()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Chart {
                ForEach(Array(genres.enumerated()), id: \.element) { index, genre in
                    ForEach(years) { year in
                        if let value = share(for: year, genre: genre) {
                            LineMark(
                                x: .value("Ano", year.year),
                                y: .value("Participação", value),
                                series: .value("Gênero", genre)
                            )
                            .foregroundStyle(color(forGenreIndex: index))
                            .lineStyle(StrokeStyle(lineWidth: 2))
                            .symbol(Circle())
                            .symbolSize(20)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks { AxisValueLabel().font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted) }
            }
            .chartYAxis {
                AxisMarks { value in
                    AxisValueLabel {
                        if let percent = value.as(Double.self) {
                            Text("\(Int(percent))%").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.fjMuted)
                        }
                    }
                }
            }
            .frame(height: 220)

            FlowLegend(items: genres.enumerated().map { index, genre in (color: color(forGenreIndex: index), label: genre) })
        }
    }
}

/// Legenda simples em linha, usada pelos gráficos de evolução com múltiplas séries.
private struct FlowLegend: View {
    let items: [(color: Color, label: String)]

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(items, id: \.label) { item in
                HStack(spacing: 4) {
                    Circle().fill(item.color).frame(width: 8, height: 8)
                    Text(item.label)
                }
            }
        }
        .font(.system(size: 10, weight: .bold))
        .foregroundStyle(Color.fjMuted)
    }
}
