// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "CoordinatorKit",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "CoordinatorKit", targets: ["CoordinatorKit"])
    ],
    dependencies: [
        .package(path: "../Kit"),
        .package(path: "../DesignKit")
    ],
    targets: [
        .target(name: "CoordinatorKit", dependencies: ["Kit", "DesignKit"])
    ]
)
