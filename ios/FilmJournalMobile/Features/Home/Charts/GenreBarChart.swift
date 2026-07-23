import SwiftUI
import Charts
import Kit
import DesignKit

/// Versão em barras horizontais da distribuição de gêneros — mesma base de dados do
/// `GenreRadar` do web (`computeGenres`), mas sem exigir desenho customizado. Ver
/// `GenreRadarChart.swift` para a versão fiel ao radar do web (mais pesada, comentada por padrão).
struct GenreBarChart: View {
    let data: [GenreCount]

    var body: some View {
        Chart(data) { row in
            BarMark(
                x: .value("Filmes", row.count),
                y: .value("Gênero", row.genre)
            )
            .foregroundStyle(Color.fjAccent)
            .cornerRadius(4)
            .annotation(position: .trailing) {
                Text("\(row.count)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.fjMuted)
            }
        }
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let label = value.as(String.self) {
                        Text(label).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color.fjTextSoft)
                    }
                }
            }
        }
        .frame(height: max(200, CGFloat(data.count) * 34))
    }
}
