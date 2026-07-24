import { PrismaClient } from "@prisma/client";
import { RISK_FLAGS, RiskFlag, Status } from "../src/lib/constants";

const prisma = new PrismaClient();

type Seed = {
  applicantName: string;
  dob: string; // YYYY-MM-DD
  mockDocumentId: string;
  address: string;
  riskFlags: RiskFlag[];
  status: Status;
  submittedAt: string; // ISO
};

// Obviously-fake applicants. No real SSNs or documents.
const applications: Seed[] = [
  { applicantName: "Ava Thompson", dob: "1990-04-12", mockDocumentId: "DOC-1001", address: "12 Maple St, Springfield, IL", riskFlags: ["name_mismatch"], status: "pending", submittedAt: "2026-07-20T09:15:00Z" },
  { applicantName: "Liam Nguyen", dob: "1985-11-03", mockDocumentId: "DOC-1002", address: "88 Oak Ave, Austin, TX", riskFlags: ["watchlist_hit", "duplicate_identity"], status: "pending", submittedAt: "2026-07-20T14:42:00Z" },
  { applicantName: "Sofia Martinez", dob: "1998-01-27", mockDocumentId: "DOC-1003", address: "451 Pine Rd, Denver, CO", riskFlags: ["blurry_document"], status: "pending", submittedAt: "2026-07-21T08:05:00Z" },
  { applicantName: "Noah Patel", dob: "1979-06-19", mockDocumentId: "DOC-1004", address: "7 Birch Ln, Seattle, WA", riskFlags: ["address_unverifiable", "name_mismatch"], status: "pending", submittedAt: "2026-07-21T16:30:00Z" },
  { applicantName: "Emma Johnson", dob: "1993-09-08", mockDocumentId: "DOC-1005", address: "300 Cedar Blvd, Miami, FL", riskFlags: ["watchlist_hit"], status: "pending", submittedAt: "2026-07-22T11:20:00Z" },

  { applicantName: "Oliver Brown", dob: "1988-02-14", mockDocumentId: "DOC-1006", address: "23 Elm St, Portland, OR", riskFlags: ["blurry_document"], status: "approved", submittedAt: "2026-07-15T10:00:00Z" },
  { applicantName: "Mia Davis", dob: "1995-12-30", mockDocumentId: "DOC-1007", address: "914 Walnut Way, Boston, MA", riskFlags: [], status: "approved", submittedAt: "2026-07-15T13:45:00Z" },
  { applicantName: "Elijah Wilson", dob: "1982-07-22", mockDocumentId: "DOC-1008", address: "56 Aspen Ct, Chicago, IL", riskFlags: ["address_unverifiable"], status: "approved", submittedAt: "2026-07-16T09:30:00Z" },
  { applicantName: "Charlotte Lee", dob: "2000-03-05", mockDocumentId: "DOC-1009", address: "77 Willow Dr, Phoenix, AZ", riskFlags: ["name_mismatch"], status: "approved", submittedAt: "2026-07-16T15:10:00Z" },
  { applicantName: "James Garcia", dob: "1975-10-11", mockDocumentId: "DOC-1010", address: "132 Spruce St, Dallas, TX", riskFlags: ["duplicate_identity"], status: "approved", submittedAt: "2026-07-17T08:55:00Z" },
  { applicantName: "Amelia Rodriguez", dob: "1991-05-17", mockDocumentId: "DOC-1011", address: "9 Poplar Pl, San Diego, CA", riskFlags: [], status: "approved", submittedAt: "2026-07-17T12:00:00Z" },

  { applicantName: "Benjamin Clark", dob: "1986-08-29", mockDocumentId: "DOC-1012", address: "44 Chestnut Ave, Atlanta, GA", riskFlags: ["watchlist_hit"], status: "rejected", submittedAt: "2026-07-14T09:00:00Z" },
  { applicantName: "Harper Lewis", dob: "1997-04-02", mockDocumentId: "DOC-1013", address: "215 Sycamore St, Nashville, TN", riskFlags: ["duplicate_identity", "name_mismatch"], status: "rejected", submittedAt: "2026-07-14T14:20:00Z" },
  { applicantName: "Lucas Walker", dob: "1983-01-09", mockDocumentId: "DOC-1014", address: "68 Magnolia Rd, Charlotte, NC", riskFlags: ["blurry_document", "address_unverifiable"], status: "rejected", submittedAt: "2026-07-15T16:40:00Z" },
  { applicantName: "Evelyn Hall", dob: "1992-11-25", mockDocumentId: "DOC-1015", address: "5 Dogwood Ln, Columbus, OH", riskFlags: ["watchlist_hit", "duplicate_identity"], status: "rejected", submittedAt: "2026-07-16T10:15:00Z" },

  { applicantName: "Henry Young", dob: "1989-06-06", mockDocumentId: "DOC-1016", address: "180 Redwood Ct, Sacramento, CA", riskFlags: ["blurry_document"], status: "approved", submittedAt: "2026-07-18T09:25:00Z" },
  { applicantName: "Abigail King", dob: "1994-02-18", mockDocumentId: "DOC-1017", address: "31 Juniper St, Kansas City, MO", riskFlags: ["name_mismatch"], status: "rejected", submittedAt: "2026-07-18T13:35:00Z" },
  { applicantName: "Sebastian Wright", dob: "1980-09-14", mockDocumentId: "DOC-1018", address: "402 Cypress Ave, Salt Lake City, UT", riskFlags: [], status: "approved", submittedAt: "2026-07-19T11:50:00Z" },
];

async function main() {
  // Start clean so re-seeding is deterministic.
  await prisma.auditLog.deleteMany();
  await prisma.application.deleteMany();

  for (const a of applications) {
    // Validate risk flags against the allowed set.
    for (const f of a.riskFlags) {
      if (!(RISK_FLAGS as readonly string[]).includes(f)) {
        throw new Error(`Invalid risk flag in seed: ${f}`);
      }
    }
    await prisma.application.create({
      data: {
        applicantName: a.applicantName,
        dob: new Date(a.dob),
        mockDocumentId: a.mockDocumentId,
        address: a.address,
        riskFlags: JSON.stringify(a.riskFlags),
        status: a.status,
        submittedAt: new Date(a.submittedAt),
      },
    });
  }

  const pending = applications.filter((a) => a.status === "pending").length;
  console.log(
    `Seeded ${applications.length} applications (${pending} pending).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
