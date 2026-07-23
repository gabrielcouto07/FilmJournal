import SwiftUI
import Kit
import DesignKit

/// Espelha `TasteDashboard.tsx` do web (a parte de gráficos) — renderizado ao final da Home.
///
/// Os dados vêm de `ChartsAnalytics.compute(from:)` (Kit), calculado no cliente a partir do
/// diário (`GET /api/logs`), já que a API mobile ainda não tem um endpoint de estatísticas
/// dedicado como o web.
///
/// Gráficos com rótulos curtos e altura fixa (décadas/duração, radar/notas, as duas linhas de
/// evolução) ficam lado a lado em grade de 2 colunas para reduzir o quanto é preciso rolar;
/// os que precisam de largura (rótulos longos, muitas categorias, ou o scatter de consenso)
/// continuam em largura cheia — igual ao web faz com `country`/`month series`.
struct HomeChartsSection: View {
    let charts: ChartsData

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.lg) {
            Text("Paladar em gráficos")
                .font(.title3.bold())
                .foregroundStyle(Color.fjText)

            // MARK: Núcleo — largura cheia (precisam de espaço para rótulos/categorias).

            ChartCard(eyebrow: "Ao longo do tempo", heading: "Ritmo de visualização") {
                if charts.monthSeries.isEmpty {
                    InsufficientDataView()
                } else {
                    MonthlyActivityChart(data: charts.monthSeries)
                }
            }

            ChartCard(eyebrow: "Geografia", heading: "De onde vêm seus filmes") {
                if charts.countries.isEmpty {
                    InsufficientDataView()
                } else {
                    CountrySpreadChart(data: Array(charts.countries.prefix(12)))
                }
            }

            ChartCard(eyebrow: "Equilíbrio de gêneros", heading: "Onde seu gosto se concentra") {
                if charts.genres.isEmpty {
                    InsufficientDataView()
                } else {
                    GenreBarChart(data: Array(charts.genres.prefix(8)))
                }
            }

            // MARK: Núcleo — grade 2x1 (rótulos curtos, altura parecida).

            HStack(alignment: .top, spacing: Spacing.md) {
                ChartCard(eyebrow: "Linha do tempo", heading: "Décadas") {
                    if charts.decades.isEmpty {
                        InsufficientDataView()
                    } else {
                        DecadeHistogramChart(data: charts.decades)
                    }
                }

                ChartCard(eyebrow: "Fôlego", heading: "Duração ideal") {
                    RuntimeDistributionChart(data: charts.runtimes)
                }
            }

            // MARK: Gráficos mais pesados — radar customizado via Canvas e séries por ano; cada
            // um já tem sua própria checagem de dado mínimo abaixo (`InsufficientDataView`).

            ChartCard(eyebrow: "Você contra a maré", heading: "Você e o consenso") {
                if charts.contrarian.isEmpty {
                    InsufficientDataView(message: "Avalie filmes com dados de público (TMDB, 50+ votos) para desbloquear esta análise.")
                } else {
                    ContrarianScatterChart(points: charts.contrarian)
                }
            }

            HStack(alignment: .top, spacing: Spacing.md) {
                ChartCard(eyebrow: "Equilíbrio de gêneros", heading: "Radar") {
                    GenreRadarChart(data: Array(charts.genres.prefix(8)))
                }

                ChartCard(eyebrow: "Sua escala", heading: "Notas") {
                    if charts.ratingDistribution.allSatisfy({ $0.count == 0 }) {
                        InsufficientDataView()
                    } else {
                        RatingDistributionChart(data: charts.ratingDistribution)
                    }
                }
            }

            if charts.timelineYears.count >= 2 {
                HStack(alignment: .top, spacing: Spacing.md) {
                    ChartCard(eyebrow: "Evolução", heading: "Notas x consenso") {
                        RatingLeanTrendChart(years: charts.timelineYears)
                    }
    
                    ChartCard(eyebrow: "Evolução", heading: "Época média") {
                        EraDriftChart(years: charts.timelineYears)
                    }
                    }

                if charts.topGenres.count >= 2 {
                    ChartCard(eyebrow: "Evolução", heading: "Gêneros em movimento") {
                        GenreShareDriftChart(years: charts.timelineYears, genres: charts.topGenres)
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.md)
    }
}
