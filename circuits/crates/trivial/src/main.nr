use dep::poseidon::poseidon2::Poseidon2;

fn main(x: Field, y: Field, result: pub Field) {
    // Chain hashes to create a meaningfully-sized circuit
    let mut acc = Poseidon2::hash([x, y], 2);
    for _ in 0..20 {
        acc = Poseidon2::hash([acc, x], 2);
    }
    assert(acc == result);
}
