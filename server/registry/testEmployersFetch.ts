import { fetchEmployers, fetchEmployerEvidence } from "./notionSync";

(async () => {
  const employers = await fetchEmployers();
  const evidence = await fetchEmployerEvidence();

  console.log("Employers:", employers.rows.length);
  console.log("Evidence:", evidence.rows.length);

  console.log("Sample employer:", employers.rows[0]);
  console.log("Sample evidence:", evidence.rows[0]);
})();