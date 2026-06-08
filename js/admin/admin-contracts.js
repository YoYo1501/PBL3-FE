function getContractFilters() {
  return {
    keyword:
      document.getElementById("contract-search")?.value.trim().toLowerCase() ||
      "",
    status: document.getElementById("contract-filter-status")?.value || "",
  };
}

function setContractError(message = "") {
  const el = document.getElementById("contract-form-error");
  if (el) el.textContent = message;
}

function setContractDetailVisible(isVisible) {
  document
    .querySelector(".contract-admin-shell")
    ?.classList.toggle("has-selected-contract", Boolean(isVisible));
  document.body.classList.toggle("modal-open", Boolean(isVisible));
}

function bindContractControls() {
  const rerenderContracts = () => {
    contractPage = 1;
    loadContracts();
  };
  document
    .getElementById("contract-search")
    ?.addEventListener("input", rerenderContracts);
  document
    .getElementById("contract-filter-status")
    ?.addEventListener("change", rerenderContracts);
  document
    .getElementById("contracts-prev-btn")
    ?.addEventListener("click", () => {
      if (contractPage <= 1) return;
      contractPage -= 1;
      loadContracts();
    });
  document
    .getElementById("contracts-next-btn")
    ?.addEventListener("click", () => {
      contractPage += 1;
      loadContracts();
    });

  document
    .getElementById("contract-edit-form")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!selectedContractId) {
        setContractError("Vui lòng chọn một hợp đồng trước khi cập nhật.");
        return;
      }

      const priceValue = document.getElementById("contract-price").value;

      const payload = {};
      if (priceValue !== "") payload.price = Number(priceValue);

      if (!Object.keys(payload).length) {
        setContractError("Hãy nhập ít nhất một thông tin cần cập nhật.");
        return;
      }

      const res = await callApi(`/contracts/${selectedContractId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res?.ok) {
        adminToast(res.data?.message || "Đã cập nhật hợp đồng.");
        setContractError("");
        await loadContracts();
        if (selectedContractId) await selectContract(selectedContractId);
      } else {
        setContractError(res?.data?.message || "Không thể cập nhật hợp đồng.");
      }
    });

  document
    .getElementById("deactivate-contract-btn")
    ?.addEventListener("click", async () => {
      if (!selectedContractId) {
        setContractError("Vui lòng chọn một hợp đồng trước khi vô hiệu hóa.");
        return;
      }

      const confirmed =
        typeof showAppConfirm === "function"
          ? await showAppConfirm({
              title: "Vô hiệu hóa hợp đồng",
              message: "Bạn có chắc muốn vô hiệu hóa hợp đồng này không?",
              confirmText: "Vô hiệu hóa",
              cancelText: "Hủy",
            })
          : confirm("Bạn có chắc muốn vô hiệu hóa hợp đồng này không?");

      if (!confirmed) return;

      const res = await callApi(`/contracts/${selectedContractId}`, {
        method: "DELETE",
      });
      if (res?.ok) {
        adminToast(res.data?.message || "Đã vô hiệu hóa hợp đồng.");
        selectedContractId = null;
        clearContractDetail();
        loadContracts();
      } else {
        setContractError(
          res?.data?.message || "Không thể vô hiệu hóa hợp đồng.",
        );
      }
    });

  document
    .getElementById("contract-detail-close-btn")
    ?.addEventListener("click", clearContractDetail);

  document
    .getElementById("contract-detail-modal")
    ?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) clearContractDetail();
    });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const modal = document.getElementById("contract-detail-modal");
    if (modal && getComputedStyle(modal).display !== "none") clearContractDetail();
  });
}

//6. Hợp đồng
async function loadContracts() {
  const tbody = document.getElementById("contracts-table-body");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" class="table-empty">Đang tải danh sách hợp đồng...</td></tr>';
  const filters = getContractFilters();
  const query = new URLSearchParams({
    page: String(contractPage),
    pageSize: String(CONTRACTS_PAGE_SIZE),
  });
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (filters.status) query.set("status", filters.status);

  const res = await callApi(`/contracts?${query.toString()}`);
  adminContracts = Array.isArray(res?.data?.items) ? res.data.items : [];
  contractPage = Number(res?.data?.page || contractPage);
  contractTotalItems = Number(res?.data?.totalItems || adminContracts.length);
  renderContractsTable();

  if (selectedContractId) {
    const exists = adminContracts.some(
      (contract) => contract.id === selectedContractId,
    );
    if (exists) {
      await selectContract(selectedContractId);
    } else {
      selectedContractId = null;
      clearContractDetail();
    }
  }
}

function renderContractsTable() {
  const tbody = document.getElementById("contracts-table-body");
  const pageInfo = document.getElementById("contracts-page-info");
  const prevBtn = document.getElementById("contracts-prev-btn");
  const nextBtn = document.getElementById("contracts-next-btn");
  if (!tbody) return;

  const totalPages = Math.max(
    1,
    Math.ceil(contractTotalItems / CONTRACTS_PAGE_SIZE),
  );
  if (contractPage > totalPages) contractPage = totalPages;
  if (contractPage < 1) contractPage = 1;

  if (pageInfo) pageInfo.textContent = `Trang ${contractPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = contractPage <= 1;
  if (nextBtn) nextBtn.disabled = contractPage >= totalPages;

  if (!adminContracts.length) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="table-empty">Không có hợp đồng phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminContracts
    .map(
      (contract) => `
        <tr class="${selectedContractId === contract.id ? "is-selected" : ""}" data-contract-view="${contract.id}">
            <td class="contract-code-cell"><span class="contract-code-link">${escapeHtml(contract.contractCode || "-")}</span></td>
            <td><span class="contract-row-icon purple">${contractUserIconSvg()}</span>${escapeHtml(contract.studentName || "-")}</td>
            <td><span class="contract-row-icon cyan">${contractRoomIconSvg()}</span>${escapeHtml(contract.roomCode || "-")} (${escapeHtml(contract.roomType || "-")})</td>
            <td class="contract-period-cell">${formatDate(contract.startDate)} -<br>${formatDate(contract.endDate)}</td>
            <td class="contract-price-cell"><span class="contract-row-icon amber">${contractPriceIconSvg()}</span>${escapeHtml(formatCurrency(contract.price))}</td>
            <td>${contractStatusBadge(contract.status)}</td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("tr[data-contract-view]").forEach((row) => {
    row.addEventListener("click", () =>
      selectContract(Number(row.dataset.contractView)),
    );
  });
}

async function selectContract(contractId) {
  const res = await callApi(`/contracts/${contractId}`);
  const contract = res?.ok ? res.data : null;
  if (!contract) {
    adminToast(res?.data?.message || "Không thể lấy chi tiết hợp đồng.", true);
    return;
  }

  selectedContractId = contract.id;
  setContractDetailVisible(true);
  document.getElementById("contract-detail-code").textContent =
    contract.contractCode || "Đã chọn";
  document.getElementById("contract-detail-student").textContent =
    contract.studentName || "-";
  document.getElementById("contract-detail-room").textContent =
    `${contract.roomCode || "-"} (${contract.roomType || "-"})`;
  document.getElementById("contract-detail-days").textContent =
    `${contract.daysRemaining ?? 0} ngày`;
  document.getElementById("contract-detail-renew").textContent =
    getContractRenewalLabel(contract);

  document.getElementById("contract-detail-period").textContent =
    `${formatDate(contract.startDate)} - ${formatDate(contract.endDate)}`;
  document.getElementById("contract-detail-status").textContent =
    normalizeContractStatusLabel(contract.status);
  document.getElementById("contract-price").value = contract.price ?? "";
  setContractError("");
  renderContractsTable();
}

function clearContractDetail() {
  selectedContractId = null;
  setContractDetailVisible(false);
  document.getElementById("contract-detail-code").textContent = "Chưa chọn";
  document.getElementById("contract-detail-student").textContent = "-";
  document.getElementById("contract-detail-room").textContent = "-";
  document.getElementById("contract-detail-days").textContent = "-";
  document.getElementById("contract-detail-renew").textContent = "-";
  document.getElementById("contract-detail-period").textContent = "-";
  document.getElementById("contract-detail-status").textContent = "-";
  document.getElementById("contract-price").value = "";
  setContractError("");
  renderContractsTable();
}

function getContractRenewalLabel(contract) {
  if (contract?.status !== "Active") return "Không thể gia hạn";
  return contract.canRenew ? "Có thể gia hạn" : "Chưa đến hạn gia hạn";
}

function contractStatusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  const className =
    normalized === "active"
      ? "active"
      : normalized === "expired"
        ? "expired"
        : normalized === "terminated" || normalized === "inactive" || normalized === "cancelled"
          ? "terminated"
          : "inactive";
  return `<span class="contract-status-pill ${className}">${escapeHtml(normalizeContractStatusLabel(status))}</span>`;
}

function normalizeContractStatusLabel(status = "") {
  if (status === "Cancelled" || status === "Inactive") return "Đã chấm dứt";

  switch (status) {
    case "Active":
      return "Đang hiệu lực";
    case "Expired":
      return "Hết hạn";
    case "Terminated":
      return "Đã chấm dứt";
    default:
      return status || "-";
  }
}

function contractUserIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"></circle><path d="M20 21a8 8 0 0 0-16 0"></path></svg>';
}

function contractRoomIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V9l9-6 9 6v12"></path><path d="M9 21v-8h6v8"></path></svg>';
}

function contractPriceIconSvg() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v12M16 9a4 4 0 0 0-4-2 4 4 0 0 0 0 8"></path></svg>';
}

