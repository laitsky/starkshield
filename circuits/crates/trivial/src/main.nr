use dep::poseidon::poseidon2::Poseidon2;

fn main(x: Field, y: Field, result: pub Field) {
    let hash = Poseidon2::hash([x, y], 2);
    assert(hash == result);
}
