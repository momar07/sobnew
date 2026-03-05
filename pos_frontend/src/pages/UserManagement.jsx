import React, { useEffect, useMemo, useState } from 'react';
import { usersAPI } from '../services/api';

const roleLabel = (groupName) => {
  const n = (groupName || '').toLowerCase();
  if (n.includes('admin')) return 'مدير النظام';
  if (n.includes('manager')) return 'مدير';
  if (n.includes('cashier')) return 'كاشير';
  return groupName || '—';
};

const UserManagement = () => {
  const [activeTab, setActiveTab] = useState('users'); // users | groups
  const [notice, setNotice] = useState(null); // { type: 'success'|'error', message: string }

  // Lists
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);

  // Loading / errors
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Search
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    groups: [],
    profile: {
      employee_number: '',
      phone: '',
    },
  });

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      // users service exposes getAll() (not getUsers)
      const res = await usersAPI.getAll();
      // DRF may return a paginated shape: { count, next, previous, results: [...] }
      const data = res?.data;
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];
      setUsers(list);
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'فشل تحميل المستخدمين. تأكد من تسجيل الدخول وصلاحياتك.' });
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const res = await usersAPI.getGroups();
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      // غالبًا المستخدم غير مسجل/غير مصرح
      setNotice({ type: 'error', message: 'فشل تحميل المجموعات. تأكد من تسجيل الدخول وصلاحياتك.' });
    } finally {
      setLoadingGroups(false);
    }
  };

  const formatApiError = (data) => {
    if (!data) return 'حدث خطأ غير متوقع.';
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (typeof data === 'object') {
      const lines = [];
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) {
          lines.push(`${k}: ${v.join(' | ')}`);
        } else if (v && typeof v === 'object') {
          for (const [k2, v2] of Object.entries(v)) {
            if (Array.isArray(v2)) lines.push(`${k2}: ${v2.join(' | ')}`);
            else lines.push(`${k2}: ${String(v2)}`);
          }
        } else {
          lines.push(`${k}: ${String(v)}`);
        }
      }
      return lines.join('\n');
    }
    return 'حدث خطأ غير متوقع.';
  };

  useEffect(() => {
    fetchUsers();
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const fullName = (u.profile?.full_name || `${u.first_name || ''} ${u.last_name || ''}`).trim();
      return (
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (fullName || '').toLowerCase().includes(q) ||
        (u.groups?.[0] || '').toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => (g.name || '').toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const openCreateUser = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      email: '',
      first_name: '',
      last_name: '',
      groups: [],
      profile: { employee_number: '', phone: '' },
    });
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      username: user.username || '',
      password: '', // optional
      email: user.email || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      // backend expects list of group ids
      groups: user.group_ids || [],
      profile: {
        employee_number: user.profile?.employee_number || '',
        phone: user.profile?.phone || '',
      },
    });
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handleUserInput = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('profile.')) {
      const key = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        profile: { ...prev.profile, [key]: value },
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (e) => {
    const groupId = e.target.value ? Number(e.target.value) : null;
    setFormData((prev) => ({
      ...prev,
      groups: groupId ? [groupId] : [],
    }));
  };

  const saveUser = async (e) => {
    e.preventDefault();
    try {
      setNotice(null);
      const payload = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        groups: formData.groups,
        profile: {
          employee_number: formData.profile?.employee_number || '',
          phone: formData.profile?.phone || '',
        },
      };
      if (formData.password) payload.password = formData.password;

      if (editingUser?.id) {
        await usersAPI.updateUser(editingUser.id, payload);
        setNotice({ type: 'success', message: 'تم تعديل المستخدم بنجاح.' });
      } else {
        if (!payload.password) {
          setNotice({ type: 'error', message: 'من فضلك أدخل كلمة المرور.' });
          return;
        }
        await usersAPI.createUser(payload);
        setNotice({ type: 'success', message: 'تم إضافة المستخدم بنجاح.' });
      }

      closeUserModal();
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: formatApiError(err?.response?.data) || 'حدث خطأ أثناء حفظ المستخدم.' });
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستخدم: ${user.username} ؟`)) return;
    try {
      setNotice(null);
      await usersAPI.deleteUser(user.id);
      await fetchUsers();
      setNotice({ type: 'success', message: 'تم حذف المستخدم بنجاح.' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: formatApiError(err?.response?.data) || 'حدث خطأ أثناء حذف المستخدم.' });
    }
  };

  const openCreateGroup = () => {
    setNewGroupName('');
    setShowGroupModal(true);
  };

  const closeGroupModal = () => {
    setShowGroupModal(false);
    setNewGroupName('');
  };

  const createGroup = async (e) => {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;
    try {
      setNotice(null);
      await usersAPI.createGroup({ name });
      closeGroupModal();
      await fetchGroups();
      setNotice({ type: 'success', message: 'تم إنشاء المجموعة بنجاح.' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: formatApiError(err?.response?.data) || 'حدث خطأ أثناء إنشاء المجموعة.' });
    }
  };

  const deleteGroup = async (g) => {
    if (!window.confirm(`هل أنت متأكد من حذف المجموعة: ${g.name} ؟`)) return;
    try {
      setNotice(null);
      await usersAPI.deleteGroup(g.id);
      await fetchGroups();
      // refresh users too (role labels)
      await fetchUsers();
      setNotice({ type: 'success', message: 'تم حذف المجموعة بنجاح.' });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: formatApiError(err?.response?.data) || 'حدث خطأ أثناء حذف المجموعة.' });
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen" dir="rtl">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">إدارة المستخدمين</h1>
      <p className="text-gray-600 mb-6">إدارة حسابات وصلاحيات الموظفين</p>

      {notice && (
        <div
          className={
            "mb-6 rounded-lg border px-4 py-3 whitespace-pre-line " +
            (notice.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800')
          }
        >
          {notice.message}
        </div>
      )}

      {/* Tabs header (same style as Reports) */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <nav className="flex gap-4 px-6 pt-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-3 font-medium ${
                activeTab === 'users'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              المستخدمين
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`pb-3 font-medium ${
                activeTab === 'groups'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              المجموعات
            </button>
          </nav>
        </div>
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex-1">
              <input
                className="input-field w-full"
                placeholder="بحث بالاسم / البريد / الصلاحية"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={openCreateUser}>
              + إضافة مستخدم جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-right text-gray-600 border-b">
                  <th className="py-3 px-3">المستخدم</th>
                  <th className="py-3 px-3">البريد</th>
                  <th className="py-3 px-3">الصلاحية</th>
                  <th className="py-3 px-3">المبيعات</th>
                  <th className="py-3 px-3">الإيراد</th>
                  <th className="py-3 px-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-gray-500">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-6 text-center text-gray-500">
                      لا يوجد مستخدمين
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="py-3 px-3">
                        <div className="font-medium text-gray-800">{u.username}</div>
                        <div className="text-sm text-gray-500">
                          {(u.profile?.full_name || `${u.first_name || ''} ${u.last_name || ''}`).trim() || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-700">{u.email || '—'}</td>
                      <td className="py-3 px-3">
                        <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                          {roleLabel(u.groups?.[0])}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-700">{u.profile?.total_sales ?? 0}</td>
                      <td className="py-3 px-3 text-gray-700">{u.profile?.total_revenue ?? 0}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-2">
                          <button className="btn-secondary" onClick={() => openEditUser(u)}>
                            تعديل
                          </button>
                          <button className="btn-danger" onClick={() => deleteUser(u)}>
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex-1">
              <input
                className="input-field w-full"
                placeholder="بحث باسم المجموعة"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={openCreateGroup}>
              + إضافة مجموعة
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-right text-gray-600 border-b">
                  <th className="py-3 px-3">اسم المجموعة</th>
                  <th className="py-3 px-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loadingGroups ? (
                  <tr>
                    <td colSpan="2" className="py-6 text-center text-gray-500">
                      جاري التحميل...
                    </td>
                  </tr>
                ) : filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="py-6 text-center text-gray-500">
                      لا يوجد مجموعات
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((g) => (
                    <tr key={g.id} className="border-b last:border-b-0">
                      <td className="py-3 px-3 text-gray-800 font-medium">{g.name}</td>
                      <td className="py-3 px-3">
                        <button className="btn-danger" onClick={() => deleteGroup(g)}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
              </h2>
              <button onClick={closeUserModal} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>

            <form onSubmit={saveUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم *</label>
                <input
                  name="username"
                  value={formData.username}
                  onChange={handleUserInput}
                  className="input-field w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  كلمة المرور {editingUser ? '(اختياري)' : '*'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleUserInput}
                  className="input-field w-full"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleUserInput}
                  className="input-field w-full"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الأول</label>
                  <input
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleUserInput}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم العائلة</label>
                  <input
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleUserInput}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الصلاحية *</label>
                <select
                  className="input-field w-full"
                  value={formData.groups?.[0] || ''}
                  onChange={handleRoleChange}
                  required
                >
                  <option value="">اختر الصلاحية</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الموظف</label>
                  <input
                    name="profile.employee_number"
                    value={formData.profile?.employee_number || ''}
                    onChange={handleUserInput}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                  <input
                    name="profile.phone"
                    value={formData.profile?.phone || ''}
                    onChange={handleUserInput}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" className="btn-secondary" onClick={closeUserModal}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">إضافة مجموعة</h2>
              <button onClick={closeGroupModal} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>
            <form onSubmit={createGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المجموعة *</label>
                <input
                  className="input-field w-full"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" className="btn-secondary" onClick={closeGroupModal}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
