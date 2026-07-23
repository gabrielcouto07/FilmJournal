import XCTest
@testable import Kit

final class RatingTests: XCTestCase {
    func testValidHalfStarIncrements() {
        XCTAssertTrue(Rating.isValid(0.5))
        XCTAssertTrue(Rating.isValid(3.0))
        XCTAssertTrue(Rating.isValid(5.0))
    }

    func testRejectsOutOfRangeOrNonHalfStep() {
        XCTAssertFalse(Rating.isValid(0))
        XCTAssertFalse(Rating.isValid(5.5))
        XCTAssertFalse(Rating.isValid(2.3))
    }
}
