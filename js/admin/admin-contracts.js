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

      const startDate = document.getElementById("contract-start-date").value;
      const endDate = document.getElementById("contract-end-date").value;
      const priceValue = document.getElementById("contract-price").value;
      const status = document.getElementById("contract-status").value;

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        setContractError("Ngay bat dau khong duoc lon hon ngay ket thuc.");
        return;
      }

      const payload = {};
      if (startDate) payload.startDate = new Date(startDate).toISOString();
      if (endDate) payload.endDate = new Date(endDate).toISOString();
      if (priceValue !== "") payload.price = Number(priceValue);
      if (status) payload.status = status;

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
      '<tr><td colspan="7" class="table-empty">Không có hợp đồng phù hợp bộ lọc hiện tại.</td></tr>';
    return;
  }

  tbody.innerHTML = adminContracts
    .map(
      (contract) => `
        <tr class="${selectedContractId === contract.id ? "is-selected" : ""}">
            <td><strong>${escapeHtml(contract.contractCode)}</strong></td>
            <td>${escapeHtml(contract.studentName || "-")}</td>
            <td>${escapeHtml(contract.roomCode || "-")} (${escapeHtml(contract.roomType || "-")})</td>
            <td>${formatDate(contract.startDate)} - ${formatDate(contract.endDate)}</td>
            <td>${escapeHtml(formatCurrency(contract.price))}</td>
            <td>${adminBadge(contract.status)}</td>
            <td>
                <button type="button" class="secondary-btn" data-contract-view="${contract.id}">Chon</button>
            </td>
        </tr>
    `,
    )
    .join("");

  tbody.querySelectorAll("[data-contract-view]").forEach((button) => {
    button.addEventListener("click", () =>
      selectContract(Number(button.dataset.contractView)),
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
  document.getElementById("contract-detail-code").textContent =
    contract.contractCode || "Da chon";
  document.getElementById("contract-detail-student").textContent =
    contract.studentName || "-";
  document.getElementById("contract-detail-room").textContent =
    `${contract.roomCode || "-"} (${contract.roomType || "-"})`;
  document.getElementById("contract-detail-days").textContent =
    `${contract.daysRemaining ?? 0} ngay`;
  document.getElementById("contract-detail-renew").textContent =
    contract.canRenew ? "Co the gia han" : "Chua den han gia han";

  document.getElementById("contract-start-date").value = toDateInputValue(
    contract.startDate,
  );
  document.getElementById("contract-end-date").value = toDateInputValue(
    contract.endDate,
  );
  document.getElementById("contract-price").value = contract.price ?? "";
  document.getElementById("contract-status").value = contract.status || "";
  setContractError("");
  renderContractsTable();
}

function clearContractDetail() {
  document.getElementById("contract-detail-code").textContent = "Chua chon";
  document.getElementById("contract-detail-student").textContent = "-";
  document.getElementById("contract-detail-room").textContent = "-";
  document.getElementById("contract-detail-days").textContent = "-";
  document.getElementById("contract-detail-renew").textContent = "-";
  document.getElementById("contract-start-date").value = "";
  document.getElementById("contract-end-date").value = "";
  document.getElementById("contract-price").value = "";
  document.getElementById("contract-status").value = "";
  setContractError("");
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

