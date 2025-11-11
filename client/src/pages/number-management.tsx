import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Phone, Plus, Edit, Trash2, Download, Upload, BarChart3, Filter, Search, RefreshCw } from "lucide-react";
import { TenantSelector } from "@/components/tenant-selector";
import { TeamsSyncDialog } from "@/components/teams-sync-dialog";
import type { CustomerTenant, PhoneNumberInventory, InsertPhoneNumberInventory, NumberStatus, NumberType, OperatorSession } from "@shared/schema";

export default function NumberManagement() {
  const { toast } = useToast();
  const [selectedTenant, setSelectedTenant] = useState<CustomerTenant | null>(null);

  // Fetch operator session for audit trail
  const { data: session } = useQuery<OperatorSession>({
    queryKey: ["/api/auth/session"],
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumberInventory | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set());
  const [bulkEditData, setBulkEditData] = useState<Partial<InsertPhoneNumberInventory>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFindingNext, setIsFindingNext] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<InsertPhoneNumberInventory>>({
    lineUri: "",
    displayName: "",
    userPrincipalName: "",
    carrier: "",
    location: "",
    usageLocation: "",
    onlineVoiceRoutingPolicy: "",
    numberType: "did",
    status: "available",
    notes: "",
    tags: "",
    numberRange: "",
  });

  // Fetch phone numbers when tenant is selected
  const { data: phoneNumbers, isLoading: isLoadingNumbers } = useQuery({
    queryKey: ["/api/numbers", selectedTenant?.id, statusFilter, typeFilter],
    enabled: !!selectedTenant,
    queryFn: async () => {
      let url = `/api/numbers?tenantId=${selectedTenant?.id}`;
      if (statusFilter && statusFilter !== "all") url += `&status=${statusFilter}`;
      if (typeFilter && typeFilter !== "all") url += `&numberType=${typeFilter}`;

      const res = await fetch(url, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
  });

  // Fetch statistics when tenant is selected
  const { data: statistics, isLoading: isLoadingStats } = useQuery({
    queryKey: ["/api/numbers/statistics", selectedTenant?.id],
    enabled: !!selectedTenant && showStats,
    queryFn: async () => {
      const res = await fetch(`/api/numbers/statistics?tenantId=${selectedTenant?.id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json();
    },
  });

  // Auto-refresh when tenant changes
  useEffect(() => {
    if (selectedTenant) {
      setStatusFilter("all");
      setTypeFilter("all");
      setShowStats(false);
    }
  }, [selectedTenant?.id]);

  // Reset form when dialogs close
  useEffect(() => {
    if (!isAddDialogOpen && !isEditDialogOpen) {
      setFormData({
        lineUri: "",
        displayName: "",
        userPrincipalName: "",
        carrier: "",
        location: "",
        usageLocation: "",
        onlineVoiceRoutingPolicy: "",
        numberType: "did",
        status: "available",
        notes: "",
        tags: "",
        numberRange: "",
      });
    }
  }, [isAddDialogOpen, isEditDialogOpen]);

  // Populate form when editing
  useEffect(() => {
    if (selectedNumber && isEditDialogOpen) {
      setFormData({
        lineUri: selectedNumber.lineUri,
        displayName: selectedNumber.displayName || "",
        userPrincipalName: selectedNumber.userPrincipalName || "",
        carrier: selectedNumber.carrier || "",
        location: selectedNumber.location || "",
        usageLocation: selectedNumber.usageLocation || "",
        onlineVoiceRoutingPolicy: selectedNumber.onlineVoiceRoutingPolicy || "",
        numberType: selectedNumber.numberType as NumberType,
        status: selectedNumber.status as NumberStatus,
        notes: selectedNumber.notes || "",
        tags: selectedNumber.tags || "",
        numberRange: selectedNumber.numberRange || "",
      });
    }
  }, [selectedNumber, isEditDialogOpen]);

  // Mutation to create phone number
  const createNumberMutation = useMutation({
    mutationFn: async (data: InsertPhoneNumberInventory) => {
      return await apiRequest("POST", "/api/numbers", data);
    },
    onSuccess: () => {
      toast({
        title: "Number added successfully",
        description: `${formData.lineUri} has been added to inventory`,
      });
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add number",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to update phone number
  const updateNumberMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<InsertPhoneNumberInventory> }) => {
      return await apiRequest("PATCH", `/api/numbers/${data.id}`, data.updates);
    },
    onSuccess: () => {
      toast({
        title: "Number updated successfully",
        description: `${formData.lineUri} has been updated`,
      });
      setIsEditDialogOpen(false);
      setSelectedNumber(null);
      queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update number",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete phone number
  const deleteNumberMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/numbers/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Number deleted successfully",
        description: "The phone number has been removed from inventory",
      });
      setIsDeleteDialogOpen(false);
      setSelectedNumber(null);
      queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete number",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFindNextAvailable = async () => {
    if (!selectedTenant) {
      toast({
        title: "No tenant selected",
        description: "Please select a tenant first",
        variant: "destructive",
      });
      return;
    }

    if (!formData.numberRange) {
      toast({
        title: "Number range required",
        description: "Please enter a number range pattern (e.g., +1555123xxxx)",
        variant: "destructive",
      });
      return;
    }

    setIsFindingNext(true);
    try {
      const response = await apiRequest("POST", "/api/numbers/next-available", {
        tenantId: selectedTenant.id,
        numberRange: formData.numberRange,
      });

      if (response.available) {
        setFormData({
          ...formData,
          lineUri: response.nextAvailable,
        });
        toast({
          title: "Next available number found",
          description: `Found ${response.nextAvailable} (${response.usedCount}/${response.totalCapacity} used, ${response.utilizationPercent}% utilized)`,
        });
      } else {
        toast({
          title: "No available numbers",
          description: response.message || "All numbers in this range are used",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Failed to find next available",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsFindingNext(false);
    }
  };

  const handleAddNumber = () => {
    if (!selectedTenant || !formData.lineUri) {
      toast({
        title: "Missing information",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    if (!session) {
      toast({
        title: "Session error",
        description: "Unable to get operator session",
        variant: "destructive",
      });
      return;
    }

    const operatorEmail = session.email;

    createNumberMutation.mutate({
      tenantId: selectedTenant.id,
      lineUri: formData.lineUri,
      displayName: formData.displayName || null,
      userPrincipalName: formData.userPrincipalName || null,
      carrier: formData.carrier || null,
      location: formData.location || null,
      usageLocation: formData.usageLocation || null,
      onlineVoiceRoutingPolicy: formData.onlineVoiceRoutingPolicy || null,
      numberType: (formData.numberType || "did") as NumberType,
      status: (formData.status || "available") as NumberStatus,
      notes: formData.notes || null,
      tags: formData.tags || null,
      numberRange: formData.numberRange || null,
      createdBy: operatorEmail,
      lastModifiedBy: operatorEmail,
    });
  };

  const handleUpdateNumber = () => {
    if (!selectedNumber) return;

    if (!session) {
      toast({
        title: "Session error",
        description: "Unable to get operator session",
        variant: "destructive",
      });
      return;
    }

    const operatorEmail = session.email;

    updateNumberMutation.mutate({
      id: selectedNumber.id,
      updates: {
        ...formData,
        lastModifiedBy: operatorEmail,
      },
    });
  };

  const handleDeleteNumber = () => {
    if (!selectedNumber) return;
    deleteNumberMutation.mutate(selectedNumber.id);
  };

  // CSV Import/Export Functions
  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return []; // Need header + at least one data row

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row: any = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        // Map CSV headers to database fields
        const fieldMap: { [key: string]: string } = {
          'Line URI': 'lineUri',
          'LineURI': 'lineUri',
          'Display Name': 'displayName',
          'DisplayName': 'displayName',
          'User Principal Name': 'userPrincipalName',
          'UserPrincipalName': 'userPrincipalName',
          'UPN': 'userPrincipalName',
          'Carrier': 'carrier',
          'Location': 'location',
          'Usage Location': 'usageLocation',
          'UsageLocation': 'usageLocation',
          'Voice Routing Policy': 'onlineVoiceRoutingPolicy',
          'OnlineVoiceRoutingPolicy': 'onlineVoiceRoutingPolicy',
          'Number Type': 'numberType',
          'NumberType': 'numberType',
          'Type': 'numberType',
          'Status': 'status',
          'Notes': 'notes',
          'Tags': 'tags',
          'Number Range': 'numberRange',
          'NumberRange': 'numberRange',
          'Range': 'numberRange',
        };

        const fieldName = fieldMap[header] || header.toLowerCase().replace(/\s+/g, '');
        row[fieldName] = value;
      });

      rows.push(row);
    }

    return rows;
  };

  const handleCSVImport = async () => {
    if (!importFile || !selectedTenant || !session) {
      toast({
        title: "Missing information",
        description: "Please select a tenant and CSV file",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      const text = await importFile.text();
      const parsedRows = parseCSV(text);

      if (parsedRows.length === 0) {
        toast({
          title: "Empty file",
          description: "The CSV file contains no data rows",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      // Prepare numbers for bulk import
      const numbers = parsedRows.map(row => ({
        lineUri: row.lineUri || row.lineuri,
        displayName: row.displayName || row.displayname || null,
        userPrincipalName: row.userPrincipalName || row.userprincipalname || null,
        carrier: row.carrier || null,
        location: row.location || null,
        usageLocation: row.usageLocation || row.usagelocation || null,
        onlineVoiceRoutingPolicy: row.onlineVoiceRoutingPolicy || row.onlinevoiceroutingpolicy || null,
        numberType: (row.numberType || row.numbertype || 'did') as NumberType,
        status: (row.status || 'available') as NumberStatus,
        notes: row.notes || null,
        tags: row.tags || null,
        numberRange: row.numberRange || row.numberrange || null,
      }));

      // Call bulk import API
      const response = await apiRequest("POST", "/api/numbers/bulk-import", {
        tenantId: selectedTenant.id,
        numbers,
      });

      const successCount = response.success?.length || 0;
      const errorCount = response.errors?.length || 0;

      toast({
        title: "Import completed",
        description: `Successfully imported ${successCount} numbers. ${errorCount} errors.`,
        variant: errorCount > 0 ? "default" : "default",
      });

      if (errorCount > 0) {
        console.error("Import errors:", response.errors);
      }

      // Refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant.id] });

      // Close dialog and reset
      setIsImportDialogOpen(false);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error.message || "Failed to import CSV file",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCSV = () => {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no phone numbers to export",
        variant: "destructive",
      });
      return;
    }

    // Define CSV headers
    const headers = [
      'Line URI',
      'Display Name',
      'User Principal Name',
      'Carrier',
      'Location',
      'Usage Location',
      'Voice Routing Policy',
      'Number Type',
      'Status',
      'Notes',
      'Tags',
      'Number Range',
      'Created By',
      'Last Modified By',
      'Created At',
      'Updated At'
    ];

    // Generate CSV content
    const csvRows = [headers.join(',')];

    phoneNumbers.forEach((number: PhoneNumberInventory) => {
      const row = [
        number.lineUri,
        number.displayName || '',
        number.userPrincipalName || '',
        number.carrier || '',
        number.location || '',
        number.usageLocation || '',
        number.onlineVoiceRoutingPolicy || '',
        number.numberType,
        number.status,
        number.notes || '',
        number.tags || '',
        number.numberRange || '',
        number.createdBy,
        number.lastModifiedBy,
        new Date(number.createdAt).toISOString(),
        new Date(number.updatedAt).toISOString(),
      ].map(value => `"${String(value).replace(/"/g, '""')}"`);

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `phone-numbers-${selectedTenant?.tenantName || 'export'}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${phoneNumbers.length} phone numbers to CSV`,
    });
  };

  // Bulk Edit Functions
  const toggleNumberSelection = (id: string) => {
    const newSelection = new Set(selectedNumbers);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedNumbers(newSelection);
  };

  const toggleAllNumbers = () => {
    if (selectedNumbers.size === phoneNumbers.length) {
      setSelectedNumbers(new Set());
    } else {
      setSelectedNumbers(new Set(phoneNumbers.map((n: PhoneNumberInventory) => n.id)));
    }
  };

  const handleBulkEdit = async () => {
    if (selectedNumbers.size === 0 || !session) {
      toast({
        title: "No numbers selected",
        description: "Please select numbers to update",
        variant: "destructive",
      });
      return;
    }

    // Filter out empty values
    const updates: any = {};
    Object.entries(bulkEditData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        updates[key] = value;
      }
    });

    // Add lastModifiedBy
    updates.lastModifiedBy = session.email;

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes specified",
        description: "Please specify at least one field to update",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest("PATCH", "/api/numbers/bulk-update", {
        tenantId: selectedTenant?.id,
        numberIds: Array.from(selectedNumbers),
        updates,
      });

      toast({
        title: "Bulk update successful",
        description: `Updated ${selectedNumbers.size} phone numbers`,
      });

      // Refresh list
      queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant?.id] });

      // Reset
      setIsBulkEditDialogOpen(false);
      setSelectedNumbers(new Set());
      setBulkEditData({});
    } catch (error: any) {
      toast({
        title: "Bulk update failed",
        description: error.message || "Failed to update phone numbers",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "available":
        return "default";
      case "used":
        return "secondary";
      case "reserved":
        return "outline";
      case "aging":
        return "destructive";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Phone className="w-6 h-6" />
          Phone Number Inventory
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage DID inventory, extensions, and phone number assignments
        </p>
      </div>

      {/* Tenant Selection */}
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Customer Tenant</CardTitle>
          <CardDescription>
            Select a customer tenant to manage phone number inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantSelector
            selectedTenant={selectedTenant}
            onSelectTenant={setSelectedTenant}
          />
        </CardContent>
      </Card>

      {/* Number Management Interface */}
      {selectedTenant && (
        <>
          {/* Statistics Card */}
          {showStats && statistics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Inventory Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{statistics.total}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold text-green-600">{statistics.byStatus.available}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Used</p>
                    <p className="text-2xl font-bold text-blue-600">{statistics.byStatus.used}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Reserved</p>
                    <p className="text-2xl font-bold text-amber-600">{statistics.byStatus.reserved}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Aging</p>
                    <p className="text-2xl font-bold text-red-600">{statistics.byStatus.aging}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Phone Number Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Number
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Phone Number</DialogTitle>
                      <DialogDescription>
                        Add a new phone number to the inventory
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="lineUri">Line URI *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="lineUri"
                            placeholder="tel:+15551234567"
                            value={formData.lineUri}
                            onChange={(e) => setFormData({ ...formData, lineUri: e.target.value })}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleFindNextAvailable}
                            disabled={isFindingNext || !formData.numberRange}
                          >
                            {isFindingNext ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Finding...
                              </>
                            ) : (
                              <>
                                <Search className="w-4 h-4 mr-2" />
                                Find Next
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enter a number range pattern below (e.g., +1555123xxxx) then click "Find Next" to auto-fill
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                          id="displayName"
                          placeholder="John Doe"
                          value={formData.displayName}
                          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="userPrincipalName">User Principal Name</Label>
                        <Input
                          id="userPrincipalName"
                          placeholder="john.doe@company.com"
                          value={formData.userPrincipalName}
                          onChange={(e) => setFormData({ ...formData, userPrincipalName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="carrier">Carrier</Label>
                        <Input
                          id="carrier"
                          placeholder="AT&T"
                          value={formData.carrier}
                          onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          placeholder="New York Office"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="usageLocation">Usage Location</Label>
                        <Input
                          id="usageLocation"
                          placeholder="US"
                          value={formData.usageLocation}
                          onChange={(e) => setFormData({ ...formData, usageLocation: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="onlineVoiceRoutingPolicy">Voice Routing Policy</Label>
                        <Input
                          id="onlineVoiceRoutingPolicy"
                          placeholder="Policy Name"
                          value={formData.onlineVoiceRoutingPolicy}
                          onChange={(e) => setFormData({ ...formData, onlineVoiceRoutingPolicy: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numberRange">Number Range</Label>
                        <Input
                          id="numberRange"
                          placeholder="+1555123xxxx"
                          value={formData.numberRange}
                          onChange={(e) => setFormData({ ...formData, numberRange: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numberType">Number Type</Label>
                        <Select value={formData.numberType} onValueChange={(value) => setFormData({ ...formData, numberType: value as NumberType })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="did">DID</SelectItem>
                            <SelectItem value="extension">Extension</SelectItem>
                            <SelectItem value="toll-free">Toll-Free</SelectItem>
                            <SelectItem value="mailbox">Mailbox</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as NumberStatus })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="used">Used</SelectItem>
                            <SelectItem value="reserved">Reserved</SelectItem>
                            <SelectItem value="aging">Aging</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="tags">Tags</Label>
                        <Input
                          id="tags"
                          placeholder="office,main-line,toll-free"
                          value={formData.tags}
                          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          placeholder="Additional notes..."
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddNumber} disabled={createNumberMutation.isPending}>
                        {createNumberMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Add Number
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import Phone Numbers from CSV</DialogTitle>
                      <DialogDescription>
                        Select a CSV file to import phone numbers. File should include headers.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="csv-file">CSV File</Label>
                        <input
                          ref={fileInputRef}
                          id="csv-file"
                          type="file"
                          accept=".csv"
                          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                        />
                        {importFile && (
                          <p className="text-sm text-muted-foreground">
                            Selected: {importFile.name} ({(importFile.size / 1024).toFixed(2)} KB)
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p className="font-semibold">Expected CSV format:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Line URI (required)</li>
                          <li>Display Name, User Principal Name, Carrier, Location</li>
                          <li>Usage Location, Voice Routing Policy</li>
                          <li>Number Type (did, extension, toll-free, mailbox)</li>
                          <li>Status (available, used, reserved, aging)</li>
                          <li>Notes, Tags, Number Range</li>
                        </ul>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setIsImportDialogOpen(false);
                        setImportFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}>
                        Cancel
                      </Button>
                      <Button onClick={handleCSVImport} disabled={!importFile || isImporting}>
                        {isImporting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Import
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" onClick={handleExportCSV} disabled={!phoneNumbers || phoneNumbers.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>

                <Button variant="outline" onClick={() => setShowStats(!showStats)}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  {showStats ? "Hide" : "Show"} Statistics
                </Button>

                <Button variant="outline" onClick={() => setIsSyncDialogOpen(true)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync from Teams
                </Button>
              </div>

              {/* Bulk Actions Bar */}
              {selectedNumbers.size > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedNumbers.size} selected</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedNumbers(new Set())}
                    >
                      Clear selection
                    </Button>
                  </div>
                  <Button
                    onClick={() => setIsBulkEditDialogOpen(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Bulk Edit
                  </Button>
                </div>
              )}

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">Filters:</Label>
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="aging">Aging</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value === "all" ? "" : value)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="did">DID</SelectItem>
                    <SelectItem value="extension">Extension</SelectItem>
                    <SelectItem value="toll-free">Toll-Free</SelectItem>
                    <SelectItem value="mailbox">Mailbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Numbers Table */}
              {isLoadingNumbers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : phoneNumbers && phoneNumbers.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedNumbers.size === phoneNumbers.length && phoneNumbers.length > 0}
                            onCheckedChange={toggleAllNumbers}
                          />
                        </TableHead>
                        <TableHead>Line URI</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead>UPN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Carrier</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phoneNumbers.map((number: PhoneNumberInventory) => (
                        <TableRow key={number.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedNumbers.has(number.id)}
                              onCheckedChange={() => toggleNumberSelection(number.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{number.lineUri}</TableCell>
                          <TableCell>{number.displayName || "-"}</TableCell>
                          <TableCell className="text-sm">{number.userPrincipalName || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(number.status)}>
                              {number.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{number.numberType}</Badge>
                          </TableCell>
                          <TableCell>{number.carrier || "-"}</TableCell>
                          <TableCell>{number.location || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedNumber(number);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedNumber(number);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No phone numbers found. Add your first number to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty State */}
      {!selectedTenant && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
              <Phone className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Select a Customer Tenant</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a customer tenant from the dropdown above to start managing phone number inventory
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Phone Number</DialogTitle>
            <DialogDescription>
              Update phone number details
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-lineUri">Line URI *</Label>
              <Input
                id="edit-lineUri"
                placeholder="tel:+15551234567"
                value={formData.lineUri}
                onChange={(e) => setFormData({ ...formData, lineUri: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-displayName">Display Name</Label>
              <Input
                id="edit-displayName"
                placeholder="John Doe"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-userPrincipalName">User Principal Name</Label>
              <Input
                id="edit-userPrincipalName"
                placeholder="john.doe@company.com"
                value={formData.userPrincipalName}
                onChange={(e) => setFormData({ ...formData, userPrincipalName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-carrier">Carrier</Label>
              <Input
                id="edit-carrier"
                placeholder="AT&T"
                value={formData.carrier}
                onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                placeholder="New York Office"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-usageLocation">Usage Location</Label>
              <Input
                id="edit-usageLocation"
                placeholder="US"
                value={formData.usageLocation}
                onChange={(e) => setFormData({ ...formData, usageLocation: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-onlineVoiceRoutingPolicy">Voice Routing Policy</Label>
              <Input
                id="edit-onlineVoiceRoutingPolicy"
                placeholder="Policy Name"
                value={formData.onlineVoiceRoutingPolicy}
                onChange={(e) => setFormData({ ...formData, onlineVoiceRoutingPolicy: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-numberRange">Number Range</Label>
              <Input
                id="edit-numberRange"
                placeholder="+1555123xxxx"
                value={formData.numberRange}
                onChange={(e) => setFormData({ ...formData, numberRange: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-numberType">Number Type</Label>
              <Select value={formData.numberType} onValueChange={(value) => setFormData({ ...formData, numberType: value as NumberType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="did">DID</SelectItem>
                  <SelectItem value="extension">Extension</SelectItem>
                  <SelectItem value="toll-free">Toll-Free</SelectItem>
                  <SelectItem value="mailbox">Mailbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as NumberStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="aging">Aging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                placeholder="office,main-line,toll-free"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setSelectedNumber(null);
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateNumber} disabled={updateNumberMutation.isPending}>
              {updateNumberMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Phone Number</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this phone number? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedNumber && (
            <div className="py-4">
              <p className="text-sm">
                <span className="font-semibold">Line URI:</span> {selectedNumber.lineUri}
              </p>
              {selectedNumber.displayName && (
                <p className="text-sm">
                  <span className="font-semibold">Display Name:</span> {selectedNumber.displayName}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteDialogOpen(false);
              setSelectedNumber(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNumber}
              disabled={deleteNumberMutation.isPending}
            >
              {deleteNumberMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Number
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkEditDialogOpen} onOpenChange={setIsBulkEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Edit Phone Numbers</DialogTitle>
            <DialogDescription>
              Update {selectedNumbers.size} phone numbers. Only filled fields will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-status">Status</Label>
              <Select value={bulkEditData.status} onValueChange={(value) => setBulkEditData({ ...bulkEditData, status: value as NumberStatus })}>
                <SelectTrigger>
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="aging">Aging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-carrier">Carrier</Label>
              <Input
                id="bulk-carrier"
                placeholder="Leave unchanged"
                value={bulkEditData.carrier || ''}
                onChange={(e) => setBulkEditData({ ...bulkEditData, carrier: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-location">Location</Label>
              <Input
                id="bulk-location"
                placeholder="Leave unchanged"
                value={bulkEditData.location || ''}
                onChange={(e) => setBulkEditData({ ...bulkEditData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-usage-location">Usage Location</Label>
              <Input
                id="bulk-usage-location"
                placeholder="Leave unchanged"
                value={bulkEditData.usageLocation || ''}
                onChange={(e) => setBulkEditData({ ...bulkEditData, usageLocation: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="bulk-voice-policy">Voice Routing Policy</Label>
              <Input
                id="bulk-voice-policy"
                placeholder="Leave unchanged"
                value={bulkEditData.onlineVoiceRoutingPolicy || ''}
                onChange={(e) => setBulkEditData({ ...bulkEditData, onlineVoiceRoutingPolicy: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="bulk-tags">Tags</Label>
              <Input
                id="bulk-tags"
                placeholder="Leave unchanged"
                value={bulkEditData.tags || ''}
                onChange={(e) => setBulkEditData({ ...bulkEditData, tags: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="bulk-notes">Notes (will append to existing)</Label>
              <Textarea
                id="bulk-notes"
                placeholder="Leave unchanged"
                value={bulkEditData.notes || ''}
                onChange={(e) => setBulkEditData({ ...bulkEditData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsBulkEditDialogOpen(false);
              setBulkEditData({});
            }}>
              Cancel
            </Button>
            <Button onClick={handleBulkEdit}>
              <Save className="w-4 h-4 mr-2" />
              Update {selectedNumbers.size} Numbers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Teams Sync Dialog */}
      {selectedTenant && (
        <TeamsSyncDialog
          open={isSyncDialogOpen}
          onOpenChange={setIsSyncDialogOpen}
          tenant={selectedTenant}
          onSyncComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/numbers", selectedTenant.id] });
          }}
        />
      )}
    </div>
  );
}
