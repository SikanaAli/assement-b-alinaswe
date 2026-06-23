async function main() {
  console.log('Seed placeholder: no records are created yet.');
}

main().catch((error) => {
  console.error('Seed failed.', error);
  process.exitCode = 1;
});
