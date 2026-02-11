from app.services.parser import (
    ParsedConstituencyResult,
    ParseError,
    parse_file,
    parse_line,
)


class TestParseLine:

    def test_normal_line_six_parties(self):
        line = "Bedford,6643,C,5276,L,2049,LD,266,Ind,2531,UKIP,2671,G"
        result = parse_line(line, 1)
        assert isinstance(result, ParsedConstituencyResult)
        assert result.constituency_name == "Bedford"
        assert result.party_votes == {
            "C": 6643,
            "L": 5276,
            "LD": 2049,
            "Ind": 266,
            "UKIP": 2531,
            "G": 2671
        }

    def test_line_with_snp_seven_parties(self):
        line = ("Edinburgh East,5678,C,12345,L,1000,LD,500,Ind,300,UKIP,800,G,"
                "9000,SNP")
        result = parse_line(line, 1)
        assert isinstance(result, ParsedConstituencyResult)
        assert len(result.party_votes) == 7
        assert result.party_votes["SNP"] == 9000

    def test_escaped_comma_single(self):
        line = ("Sheffield\\, Hallam,8788,C,4277,L,2281,LD,211,Ind,1028,UKIP,"
                "229,G")
        result = parse_line(line, 1)
        assert isinstance(result, ParsedConstituencyResult)
        assert result.constituency_name == "Sheffield, Hallam"
        assert result.party_votes["C"] == 8788

    def test_escaped_comma_double(self):
        line = ("Inverness\\, Nairn\\, Badenoch and Strathspey,1000,C,2000,L,"
                "300,LD,100,Ind,50,UKIP,400,G,5000,SNP")
        result = parse_line(line, 1)
        assert isinstance(result, ParsedConstituencyResult)
        assert result.constituency_name == ("Inverness, Nairn, Badenoch and "
                                            "Strathspey")

    def test_empty_line(self):
        result = parse_line("", 1)
        assert isinstance(result, ParseError)
        assert "Empty line" in result.error

    def test_too_few_fields(self):
        result = parse_line("JustAName,100", 1)
        assert isinstance(result, ParseError)
        assert "Too few fields" in result.error

    def test_odd_number_of_fields(self):
        result = parse_line("Bedford,6643,C,5276", 1)
        assert isinstance(result, ParseError)
        assert "Odd number" in result.error

    def test_invalid_vote_count(self):
        result = parse_line("Bedford,abc,C,5276,L", 1)
        assert isinstance(result, ParseError)
        assert "Invalid vote count" in result.error

    def test_negative_votes(self):
        result = parse_line("Bedford,-100,C,5276,L", 1)
        assert isinstance(result, ParseError)
        assert "Negative" in result.error

    def test_unknown_party_code(self):
        result = parse_line("Bedford,100,XYZ,200,L", 1)
        assert isinstance(result, ParseError)
        assert "Unknown party code" in result.error

    def test_duplicate_party_code(self):
        result = parse_line("Bedford,100,C,200,C", 1)
        assert isinstance(result, ParseError)
        assert "Duplicate" in result.error

    def test_empty_constituency_name(self):
        result = parse_line(",100,C,200,L", 1)
        assert isinstance(result, ParseError)
        assert "Empty constituency name" in result.error

    def test_zero_votes_allowed(self):
        result = parse_line("Bedford,0,C,0,L", 1)
        assert isinstance(result, ParsedConstituencyResult)
        assert result.party_votes == {"C": 0, "L": 0}

    def test_whitespace_trimmed(self):
        line = "  Bedford , 6643 , C , 5276 , L  "
        result = parse_line(line, 1)
        assert isinstance(result, ParsedConstituencyResult)
        assert result.constituency_name == "Bedford"


class TestParseFile:

    def test_empty_file(self):
        results, errors = parse_file("")
        assert results == []
        assert errors == []

    def test_file_with_blank_lines(self):
        content = "Bedford,100,C,200,L\n\n\nOxford,300,C,400,L\n"
        results, errors = parse_file(content)
        assert len(results) == 2
        assert len(errors) == 0

    def test_mixed_valid_and_invalid(self):
        content = "Bedford,100,C,200,L\nBadLine\nOxford,300,C,400,L"
        results, errors = parse_file(content)
        assert len(results) == 2
        assert len(errors) == 1
        assert errors[0].line_number == 2

    def test_all_invalid(self):
        content = "BadLine1\nBadLine2"
        results, errors = parse_file(content)
        assert len(results) == 0
        assert len(errors) == 2

    def test_single_valid_line(self):
        content = "Bedford,100,C,200,L"
        results, errors = parse_file(content)
        assert len(results) == 1
        assert results[0].constituency_name == "Bedford"
